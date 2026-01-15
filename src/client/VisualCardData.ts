import CardData, {CardActionType, Species} from "../CardData.js";
import cards from "../Cards.js";
import {game as visualGame} from "../index.js";
import {EndType, VAttackingState, VisualGameState, VPickCardsState} from "./VisualGameStates.js";
import VisualCard from "./VisualCard.js";
import {sideTernary} from "../consts.js";
import {network, successOrFail} from "../networking/Server.js";
import {CardAction, ClarificationJustification, ClarifyCardEvent,} from "../networking/Events.js";
import Card, {MiscDataStrings, Stat} from "../Card.js";
import {AmberData, CardActionOptions} from "../networking/CardActionOption.js";
import {BeforeGameState, GameState, type TurnState} from "../GameStates.js";
import {Vector3} from "three";
import {GameMiscDataStrings} from "../Game.js";
import {Side} from "../GameElement.js";
import {waitForClarify} from "../networking/LocalServer.js";
import {tempHowToUse} from "./ui.js";

export function loadFrontendWrappers(){}

export const visualCardClientActions:{[k:string]:(card:VisualCard)=>Promise<boolean>} = {};

function lastAction(callback:(card:VisualCard)=>Promise<boolean>){
    return (card:VisualCard)=> {
        if (visualGame.state instanceof VAttackingState && visualGame.state.parentState.getActionsLeft() === 1) {
            return callback(card);
        }
        return new Promise<boolean>(r=>r(false));
    }
}

visualCardClientActions["og-001"] = lastAction((card)=>{
    const oldStates:[VisualGameState<any>, GameState] = [visualGame.state, visualGame.getGame().state];
    let picked = new Set<Card>();
    let resolve:(val:boolean)=>void;
    const toReturn = new Promise<boolean>(r=>resolve=r);
    tempHowToUse("K9 Agent Alpha", "Select all the canines you want to use, then press Finish. " +
        "Then, select the card you want to scare. Then, select the color of the stat you want to attack with.")
    visualGame.setState(new VPickCardsState(visualGame, oldStates,
            sideTernary(card.getSide(), visualGame.fieldsA, visualGame.fieldsB).map(field => field.getCard())
                .filter(card => card !== undefined)
                .filter(card => card?.logicalCard.cardData.species === Species.CANINE)
                .filter(card => !card?.logicalCard.hasAttacked), (toAttackWith)=>{
                if(picked.has(toAttackWith.logicalCard)) picked.delete(toAttackWith.logicalCard);
                else picked.add(toAttackWith.logicalCard);
            }, EndType.BOTH, ()=>{
                visualGame.setState(new VPickCardsState(visualGame, oldStates,
                    sideTernary(card.getSide(), visualGame.fieldsB, visualGame.fieldsA).map(field => field.getCard())
                        .filter(card => card !== undefined),
                    (toAttack)=>{
                        let thirdState:VPickCardsState;
                        const statCards = [
                            new VisualCard(visualGame, new Card(cards["temp_red"]!, Side.A, card.game.getGame(), -1), new Vector3()),
                            new VisualCard(visualGame, new Card(cards["temp_blue"]!, Side.A, card.game.getGame(), -1), new Vector3()),
                            new VisualCard(visualGame, new Card(cards["temp_yellow"]!, Side.A, card.game.getGame(), -1), new Vector3()),
                        ];
                        visualGame.setState(thirdState=new VPickCardsState(visualGame, oldStates, statCards,
                            (attackStat)=>{
                                thirdState.cancel();
                                network.sendToServer(new CardAction({
                                    cardId:card.logicalCard.id,
                                    actionName:CardActionOptions.K9_ALPHA,
                                    cardData:{
                                        canineFields:sideTernary(card.getSide(), visualGame.getGame().fieldsA, visualGame.getGame().fieldsB)
                                            .map(card => card !== undefined && picked.has(card)),
                                        attack:sideTernary(card.getSide(), visualGame.getGame().fieldsB, visualGame.getGame().fieldsA).indexOf(toAttack.logicalCard)+1 as 1|2|3,
                                        attackWith:{
                                            "temp_red":Stat.RED,
                                            "temp_blue":Stat.BLUE,
                                            "temp_yellow":Stat.YELLOW,
                                        }[attackStat.logicalCard.cardData.name]!
                                    }
                                }));
                                resolve(true);
                                //why arent cards removing
                            }, EndType.NONE), oldStates[1]);
                    },EndType.CANCEL), oldStates[1]);
            }),
        oldStates[1]);
    return toReturn;
});
visualCardClientActions["og-018"] = async (card) =>{
    const toReorder = sideTernary(card.getSide(), visualGame.deckA, visualGame.deckB).getCards().slice(-2);
    if(toReorder.length === 0) return false;
    let resolve;
    const toReturn = new Promise<boolean>(r=>resolve=r);

    network.sendToServer(new ClarifyCardEvent({
        id:card.logicalCard.id,
        justification:ClarificationJustification.AMBER
    })).onReply(()=>{
        tempHowToUse("Amber", "Click the card you want to keep; don't click the card you want to discard");
        if(toReorder.length === 1){
            toReorder.push(new VisualCard(card.game, new Card(cards["unknown"]!, card.getSide(), card.game.getGame(), -1), new Vector3()));
        }
        visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
            toReorder, (c) => {
                network.sendToServer(new CardAction({
                    cardId: card.logicalCard.id,
                    actionName: CardActionOptions.AMBER_PICK,
                    cardData: {
                        which: c.logicalCard === toReorder[0]?.logicalCard ? AmberData.KEEP_FIRST : AmberData.KEEP_SECOND
                    }
                }));
                resolve!(true);
            }, EndType.NONE), visualGame.getGame().state);

    });
    return toReturn;
};
visualCardClientActions["og-028"] = lastAction((card)=>{
    if(card.logicalCard.hasAttacked) return new Promise(r=>r(false));

    let resolve;
    const toReturn = new Promise<boolean>(r=>resolve=r);

    const toScare = new Set<number>();
    const fields = sideTernary(card.getSide(), visualGame.fieldsA, visualGame.fieldsB);
    const oldStates:[VisualGameState<any>, GameState]=[visualGame.state, visualGame.getGame().state];
    const state = new VPickCardsState(visualGame, oldStates,
        fields.map(field=>field.getCard()).filter(card=>card!==undefined),
        (picked)=>{
            if(toScare.has(picked.logicalCard.id)) toScare.delete(picked.logicalCard.id);
            else toScare.add(picked.logicalCard.id);

            state.endType = (toScare.size <= sideTernary(card.getSide(), visualGame.handA, visualGame.handB).cards
                .filter(card=>card.logicalCard.cardData.level === 3).length &&
                toScare.size >=1)?EndType.BOTH:EndType.CANCEL;
        }, EndType.CANCEL, ()=>{
            if(toScare.size===0) return resolve!(true);

            const toReplace:number[] = [];
            const state2 = new VPickCardsState(visualGame, oldStates,
                sideTernary(card.getSide(), visualGame.handA, visualGame.handB).cards
                    .filter(card=>card.logicalCard.cardData.level === 3),
                (picked)=>{
                    if(toReplace.indexOf(picked.logicalCard.id) !== -1)
                        toReplace.splice(toReplace.indexOf(picked.logicalCard.id),1);
                    else toReplace.push(picked.logicalCard.id);

                    state2.endType = toScare.size === toReplace.length ? EndType.BOTH : EndType.CANCEL;
                },EndType.CANCEL,()=>{
                    let toSend:[number|false,number|false,number|false] = [false,false,false];
                    for(let i=0;i<3;i++){
                        if(toScare.has(fields[i]!.getCard()?.logicalCard.id ?? -1))
                            toSend[i] = toReplace.pop()!;
                    }

                    network.sendToServer(new CardAction({
                        cardId:card.logicalCard.id,
                        actionName:CardActionOptions.KIBBY_SCARE,
                        cardData:{cards:toSend}
                    }));
                    resolve!(true);
                });
            visualGame.setState(state2, visualGame.getGame().state);
        });
    visualGame.setState(state, visualGame.getGame().state);

    return toReturn;
})
visualCardClientActions["og-038"] = lastAction((card)=>{
    const cards = sideTernary(card.getSide(), visualGame.runawayA, visualGame.runawayB).getCards()
        .filter(card => card?.logicalCard.cardData.level === 1);
    let resolve;
    const toReturn = new Promise<boolean>(r=>resolve=r);
    if(cards.length===0) {
        resolve!(false);
        return toReturn;
    }
    visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
            cards, (picked)=>{
                    visualGame.frozen=true;
                    network.sendToServer(new CardAction({
                        cardId:card.logicalCard.id,
                        actionName:CardActionOptions.WORICK_RESCUE,
                        cardData:{
                            id:picked.logicalCard.id
                        }
                    })).onReply(successOrFail(()=>{
                        sideTernary(card.getSide(), visualGame.handA, visualGame.handB).addCard(picked);
                        (visualGame.state as VPickCardsState).cancel();
                    },()=>{},()=>{
                        visualGame.frozen=false;
                        resolve!(true);
                    }));
            }, EndType.BOTH),
        visualGame.getGame().state);
    return toReturn;
});
visualCardClientActions["og-041"] = (card)=>{
    if(sideTernary(card.getSide(), card.game.getGame().deckA, card.game.getGame().deckB).length<=0)
        return new Promise<boolean>(r=>r(true));

    let resolve;
    const toReturn = new Promise<boolean>(r=>resolve=r);

    waitForClarify(ClarificationJustification.FURMAKER, ()=>{
        visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
            sideTernary(card.getSide(), card.game.deckA, card.game.deckB).getCards(), (picked)=>{
                visualGame.frozen=true;
                network.sendToServer(new CardAction({
                    cardId:card.logicalCard.id,
                    actionName: CardActionOptions.FURMAKER_PICK,
                    cardData: {id:picked.logicalCard.id},
                })).onReply(successOrFail(()=>{},()=>{},()=>{
                    visualGame.frozen=false;
                    resolve!(true);
                }));
            }, EndType.NONE), visualGame.getGame().state);
    });

    network.sendToServer(new ClarifyCardEvent({
        id:card.logicalCard.id,
        justification:ClarificationJustification.FURMAKER,
    }));

    return toReturn;
};

//--

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}
function waitToDraw(data:CardData){
    wrap(data, CardActionType.PRE_PLACED, (orig, {self, game})=>{
        if(orig) orig({self, game});
        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)!.waiting=true;
    });
}

waitToDraw(cards["og-005"]!);
wrap(cards["og-005"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    tempHowToUse("Brownie","Click the card you want to add to your hand")
    network.sendToServer(new ClarifyCardEvent({
        id:self.id,
        justification:ClarificationJustification.BROWNIE,
    })).onReply(successOrFail(()=>{
        const cards = sideTernary(self.side, game.deckA, game.deckB).filter(card =>
            card.cardData.level === 1 && card.isAlwaysFree());
        visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, (game.state as TurnState)], visualGame.elements.filter(element =>
            VisualCard.getExactVisualCard(element) && cards.some(card => (element as VisualCard).logicalCard.id === card.id)) as VisualCard[], (card)=>{

            const state = visualGame.state as VPickCardsState;
            state.cards.splice(state.cards.indexOf(card),1)[0]?.removeFromGame();

            const deck = sideTernary(card.getSide(), visualGame.deckA, visualGame.deckB);
            const toRemove =deck.getCards().find(c => c.logicalCard.id === card.logicalCard.id);
            if(toRemove) {
                deck.removeCard(toRemove);
                toRemove.setRealPosition(card.position.clone());
                toRemove.setRealRotation(card.rotation.clone());
                toRemove.flipFaceup();
                sideTernary(card.getSide(), visualGame.handA, visualGame.handB).addCard(toRemove);
                network.sendToServer(new CardAction({
                    cardId:self.id,
                    actionName: CardActionOptions.BROWNIE_DRAW,
                    cardData: {
                        id:toRemove.logicalCard.id
                    },
                })).onReply(successOrFail(()=>{
                    game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
                }));
            }

            state.cancel();
        }, EndType.NONE), game.state);
    }));
});
waitToDraw(cards["og-009"]!);
wrap(cards["og-009"]!, CardActionType.PLACED, (orig, {self, game}) =>{
    if(orig) orig({self, game});

    const target=sideTernary(self.side, game.fieldsB, game.fieldsA).filter(card => card !== undefined);
    if(target.length>=2 &&//if there are at least 2 cards on opponent field
        target.some(card => //and at least one card has at least 1 stat less than 2
            ((card.cardData.stat(Stat.RED)??99)<2 || (card.cardData.stat(Stat.BLUE)??99)<2 || (card.cardData.stat(Stat.YELLOW)??99)<2))) {

        tempHowToUse("Gremlin Kitten", "Select the card to scare");
        visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
            sideTernary(self.side, visualGame.fieldsB, visualGame.fieldsA).map(field=>field.getCard())
                .filter(card => card !== undefined &&
                        ((card.logicalCard.cardData.stat(Stat.RED)??99)<2||
                        (card.logicalCard.cardData.stat(Stat.BLUE)??99)<2||
                        ((card.logicalCard.cardData.stat(Stat.YELLOW)??99)<2))) as VisualCard[],
            (card) => {
                network.sendToServer(new CardAction({cardId:self.id, actionName:CardActionOptions.GREMLIN_SCARE, cardData:{
                    position:(sideTernary(self.side, visualGame.fieldsB, visualGame.fieldsA)
                        .findIndex(field => field.getCard()?.logicalCard === card.logicalCard)+1) as 1|2|3
                }}));
            }, EndType.CANCEL, ()=>{
                network.sendToServer(new CardAction({cardId:self.id, actionName:CardActionOptions.GREMLIN_SCARE, cardData:{}}))
                    .onReply(successOrFail(()=>{
                        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
                    }));
            }), visualGame.getGame().state);
    }else{
        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
    }
});
waitToDraw(cards["og-011"]!);
wrap(cards["og-011"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});
    game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
});
wrap(cards["og-027"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    tempHowToUse("Yashi MauMau", "Select your three cards, then press Finish. "+
        "Click the cards in order of top to bottom: the first card will be on top of " +
        "the deck and the last card will be third (or second or whatever)");
    waitForClarify(ClarificationJustification.YASHI, ()=>{
        visualGame.frozen=false;

        let toSend:[number?,number?,number?] = [];
        const origState = visualGame.state;
        const firstState = new VPickCardsState(visualGame, [origState, game.state],
            sideTernary(self.side, visualGame.deckA, visualGame.deckB).getCards(),
            (picked)=>{
                const index = toSend.indexOf(picked.logicalCard.id);
                if(index !== -1)
                    toSend.splice(index,1);
                else
                    toSend.push(picked.logicalCard.id);
                if(toSend.length>3)
                    //@ts-ignore
                    toSend=toSend.slice(1);
                firstState.endType = toSend.length > 0 ? EndType.FINISH : EndType.NONE;
            }, EndType.NONE, ()=>{
                let newOrder:[number?,number?,number?]=[];
                const toCancel = new VPickCardsState(visualGame, [origState, game.state],
                    sideTernary(self.side, visualGame.deckA, visualGame.deckB).getCards()
                        .filter(card=>toSend.indexOf(card.logicalCard.id) !== -1),
                    (picked)=>{
                        const index = newOrder.indexOf(picked.logicalCard.id);
                        if(index !== -1)
                            newOrder.splice(index,1);
                        else
                            newOrder.push(picked.logicalCard.id);

                        if(newOrder.length === toSend.length){
                            network.sendToServer(new CardAction({
                                cardId:self.id,
                                actionName:CardActionOptions.YASHI_REORDER,
                                cardData:{cards:newOrder},
                            }));
                            toCancel.cancel();
                        }
                    },EndType.NONE);
                visualGame.setState(toCancel, game.state);
            })
        visualGame.setState(firstState, game.state);
    });
    visualGame.frozen=true;
});
wrap(cards["og-031"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    waitForClarify(ClarificationJustification.FOXY_MAGICIAN, ()=>{
        const state = new VPickCardsState(visualGame, [visualGame.state,game.state],
            sideTernary(self.side, visualGame.deckA, visualGame.deckB).getCards(),
            (picked)=>{
                network.sendToServer(new CardAction({
                    cardId:self.id,
                    actionName:CardActionOptions.FOXY_MAGICIAN_PICK,
                    cardData:picked.logicalCard.id
                }));
                state.cancel();

                waitForClarify(ClarificationJustification.FOXY_MAGICIAN, (event)=>{
                    if(event instanceof ClarifyCardEvent && event.data.id === picked.logicalCard.id) {
                        picked.flipFaceup();
                        sideTernary(self.side, visualGame.handA, visualGame.handB).addCard(picked);
                    }
                });
            },EndType.NONE);
        visualGame.setState(state, game.state);
    });
});
wrap(cards["og-032"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    waitForClarify(ClarificationJustification.DCW, ()=>{
        const oldStates:[VisualGameState<any>,GameState]=[visualGame.state,game.state];
        const state = new VPickCardsState(visualGame, oldStates,
            sideTernary(self.side, visualGame.deckA, visualGame.deckB).getCards(),
                (picked)=>{
                    network.sendToServer(new CardAction({
                        cardId:self.id,
                        actionName:CardActionOptions.DCW_PICK,
                        cardData:picked.logicalCard.id
                    }));
                    state.cancel();

                    waitForClarify(ClarificationJustification.DCW, (event)=>{
                        if(event instanceof ClarifyCardEvent && event.data.id === -1) {
                            //scare any card
                            const state2 = new VPickCardsState(visualGame, oldStates,
                                [...visualGame.fieldsA, ...visualGame.fieldsB].map(field=>field.getCard())
                                    .filter(card=>card !== undefined),
                                (picked2)=>{
                                    network.sendToServer(new CardAction({
                                        cardId:self.id,
                                        actionName:CardActionOptions.DCW_SCARE,
                                        cardData:{
                                            side:picked2.getSide(),
                                            pos:sideTernary(picked2.getSide(), visualGame.fieldsA, visualGame.fieldsB)
                                                .findIndex(field=>field.getCard()?.logicalCard.id === picked2.logicalCard.id) + 1
                                        }
                                    }));
                                    state2.cancel();
                                },EndType.NONE);
                            visualGame.setState(state2, oldStates[1]);
                        }
                    });
                },EndType.NONE);
        visualGame.setState(state, game.state);
    });
});
wrap(cards["og-041"]!, CardActionType.VISUAL_TICK, (_, {self})=>{
    if(self.getMiscData(MiscDataStrings.FURMAKER_ALREADY_ASKED_FOR) === undefined)
        self.setMiscData(MiscDataStrings.FURMAKER_ALREADY_ASKED_FOR, new Set());
    if(self.side !== visualGame.getMySide()){
        const alreadyAskedFor = self.getMiscData(MiscDataStrings.FURMAKER_ALREADY_ASKED_FOR)!;
        const askFor = sideTernary(self.side, visualGame.handA, visualGame.handB).cards.filter(card=>
            !alreadyAskedFor.has(card.logicalCard.id));
        if(askFor.length>0) {
            for(const card of askFor)
                alreadyAskedFor.add(card.logicalCard.id);
            network.sendToServer(new ClarifyCardEvent({
                id: -1,
                justification: ClarificationJustification.FURMAKER_VISIBLE
            }));
        }
    }
});
wrap(cards["og-043"]!, CardActionType.PRE_PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    if(game.state instanceof BeforeGameState){
        tempHowToUse("Cloud Cat", "Whatever the opponent places will be disabled :)");
        network.sendToServer(new CardAction({
            cardId:self.id,
            actionName:CardActionOptions.CLOUD_CAT_PICK,
            cardData:1
        }));
        self.setMiscData(MiscDataStrings.CLOUD_CAT_ALREADY_PICKED, true);
    }
})
wrap(cards["og-043"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});
    if(self.getMiscData(MiscDataStrings.CLOUD_CAT_ALREADY_PICKED)) return;


    tempHowToUse("Cloud Cat", "Click the card to disable");
    const state = new VPickCardsState(visualGame, [visualGame.state, game.state],
        sideTernary(self.side, visualGame.fieldsB, visualGame.fieldsA)
            .map(magnet=>magnet.getCard())
            .filter(card=>card!==undefined),
        (card)=>{
            network.sendToServer(new CardAction({
                cardId:self.id,
                actionName:CardActionOptions.CLOUD_CAT_PICK,
                cardData:sideTernary(card.getSide(), visualGame.fieldsA, visualGame.fieldsB)
                    .map(magnet=>magnet.getCard())
                    .findIndex(mCard=>mCard?.logicalCard.id === card.logicalCard.id)+1
            }));
            state.cancel();
        }, EndType.NONE);
    visualGame.setState(state, game.state);
});
