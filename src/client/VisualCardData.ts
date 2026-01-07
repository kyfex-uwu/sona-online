import CardData, {CardActionType, Species} from "../CardData.js";
import cards from "../Cards.js";
import {game as visualGame} from "../index.js";
import {EndType, VAttackingState, VisualGameState, VPickCardsState} from "./VisualGameStates.js";
import VisualCard from "./VisualCard.js";
import {sideTernary} from "../consts.js";
import {network, successOrFail} from "../networking/Server.js";
import {CardAction, ClarificationJustification, ClarifyCardEvent} from "../networking/Events.js";
import Card, {MiscDataStrings, Stat} from "../Card.js";
import {CardActionOptions} from "../networking/CardActionOption.js";
import {GameState, type TurnState} from "../GameStates.js";
import {Vector3} from "three";
import {GameMiscDataStrings} from "../Game.js";
import {Side} from "../GameElement.js";

export function loadFrontendWrappers(){}

export const visualCardClientActions:{[k:string]:(card:VisualCard)=>boolean} = {};

function lastAction(callback:(card:VisualCard)=>boolean){
    return (card:VisualCard)=> {
        if (visualGame.state instanceof VAttackingState && visualGame.state.parentState.getActionsLeft() === 1) {
            return callback(card);
        }
        return false;
    }
}

visualCardClientActions["og-001"] = lastAction((card)=>{
    let picked = new Set<Card>();
    const oldStates:[VisualGameState<any>, GameState] = [visualGame.state, visualGame.getGame().state];
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
                        visualGame.setState(thirdState=new VPickCardsState(visualGame, oldStates,
                            [
                                new VisualCard(visualGame, new Card(cards["temp_red"]!, Side.A, -1), new Vector3()),
                                new VisualCard(visualGame, new Card(cards["temp_blue"]!, Side.A, -1), new Vector3()),
                                new VisualCard(visualGame, new Card(cards["temp_yellow"]!, Side.A, -1), new Vector3()),
                            ],
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
                            }, EndType.NONE), oldStates[1]);
                    },EndType.NONE), oldStates[1]);
            }),
        oldStates[1]);
    return true;
});
visualCardClientActions["og-018"] = (card) =>{
    const toReorder = sideTernary(card.getSide(), visualGame.deckA, visualGame.deckB).getCards().slice(-2);
    if(toReorder.length === 0) return false;
    if(toReorder.length === 1){
        toReorder.push(new VisualCard(card.game, new Card(cards["unknown"]!, card.getSide(), -1), new Vector3()));
    }

    visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
            toReorder, (c)=>{
            network.sendToServer(new CardAction({
                cardId:card.logicalCard.id,
                actionName:CardActionOptions.AMBER_PICK,
                cardData: c.logicalCard === toReorder[0]?.logicalCard ? 1 : 2
            })).onReply(successOrFail(()=>{

            },()=>{

            },()=>{
                (visualGame.state as VPickCardsState).cancel();
            }));
        }, EndType.NONE), visualGame.getGame().state);
    return true;
};
visualCardClientActions["og-038"] = lastAction((card)=>{
    const cards = sideTernary(card.getSide(), visualGame.runawayA, visualGame.runawayB).getCards()
        .filter(card => card?.logicalCard.cardData.level === 1);
    if(cards.length===0) return false;
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
                    }));
            }, EndType.BOTH),
        visualGame.getGame().state);
    return true;
});
visualCardClientActions["og-041"] = (card)=>{
    if(sideTernary(card.getSide(), card.game.getGame().deckA, card.game.getGame().deckB).length<=0) return false;

    network.sendToServer(new ClarifyCardEvent({
        id:card.logicalCard.id,
        justification:ClarificationJustification.FURMAKER,
    }));
    visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
        sideTernary(card.getSide(), card.game.deckA, card.game.deckB).getCards(), (picked)=>{
            visualGame.frozen=true;
            network.sendToServer(new CardAction({
                cardId:card.logicalCard.id,
                actionName: CardActionOptions.FURMAKER_PICK,
                cardData:picked.logicalCard.id,
            })).onReply(successOrFail(()=>{
                sideTernary(card.getSide(), card.game.deckA, card.game.deckB).removeCard(picked.getReal())
            },()=>{},()=>visualGame.frozen=false));
        }, EndType.NONE), visualGame.getGame().state);

    return true;
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

    const cards = sideTernary(self.side, game.deckA, game.deckB).filter(card =>
        card.cardData.level === 1 && card.cardData.getAction(CardActionType.IS_FREE) !== undefined);
    for(const card of cards){
        network.sendToServer(new ClarifyCardEvent({
            id:card.id,
            justification: ClarificationJustification.BROWNIE
        }));
    }

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
});
waitToDraw(cards["og-009"]!);
wrap(cards["og-009"]!, CardActionType.PLACED, (orig, {self, game}) =>{
    if(orig) orig({self, game});

    const target=sideTernary(self.side, game.fieldsB, game.fieldsA).filter(card => card !== undefined);
    if(target.length>=2 &&//if there are at least 2 cards on opponent field
        target.some(card => //and at least one card has at least 1 stat less than 2
            ((card.cardData.stat(Stat.RED)??99)<2 || (card.cardData.stat(Stat.BLUE)??99)<2 || (card.cardData.stat(Stat.YELLOW)??99)<2))) {

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
            firstState.endType = toSend.length === 3 ? EndType.FINISH : EndType.NONE;
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
                            cardData:newOrder,
                        }));
                        toCancel.cancel();
                    }
                },EndType.NONE);
            visualGame.setState(toCancel, game.state);
        })
    visualGame.setState(firstState, game.state);
})
wrap(cards["og-032"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    const state = new VPickCardsState(visualGame, [visualGame.state,game.state],
        sideTernary(self.side, visualGame.deckA, visualGame.deckB).getCards(),
        (card)=>{
            self.setMiscData(MiscDataStrings.DCW_PICKED_LEVEL, card.logicalCard.cardData.level);
            state.cancel();
        },EndType.NONE,()=>{});
    visualGame.setState(state, (game.state as TurnState));
});
