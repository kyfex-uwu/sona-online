import CardData, {CardTriggerType, Species} from "../CardData.js";
import cards from "../Cards.js";
import {VGuiState, VisualGameState, VPickCardsState, VTurnState} from "./VisualGameStates.js";
import VisualCard, {newHighlightLock} from "./VisualCard.js";
import {externalPromise, sideTernary, statTernary} from "../consts.js";
import {network, successOrFail} from "../networking/Server.js";
import {CardAction, ClarificationJustification, ClarifyCardEvent,} from "../networking/Events.js";
import {CardMiscDataStrings, Stat} from "../Card.js";
import {AmberData, CardActionOptions} from "../networking/CardActionOption.js";
import {BeforeGameState, GameState, TurnState} from "../GameStates.js";
import {Vector2, Vector3} from "three";
import {GameMiscDataStrings} from "../Game.js";
import {getLocalGame, waitForClarify} from "../networking/LocalGameServer.js";
import {
    animation,
    blueStatColor,
    particleStreak,
    redStatColor,
    registerDrawCallback,
    tempHowToUse,
    whiteColor,
    yellowStatColor
} from "./ui.js";
import {ViewType} from "./VisualGame.js";
import {EndType, StateFeatures} from "./VisualGameStateTools.js";

function lastAction(){
    const state = getLocalGame().state.getNonVisState();
    if(state instanceof TurnState) state.actionsLeft=-1;
}

export const visualCardClientActions:{[k:string]:(card:VisualCard)=>Promise<boolean>} = {};

const og001Highlight = newHighlightLock();
visualCardClientActions["og-001"] = (card)=>{
    const toReturn = externalPromise<boolean>();
    const oldStates:[VisualGameState<any>, GameState] = [getLocalGame().state, getLocalGame().getGame().state];

    const toRemove: (() => void)[] = [];
    const attackWith:Set<VisualCard> = new Set([card]);
    card.highlight(true, og001Highlight);
    let attacking:VisualCard|undefined=undefined;
    let attackStat:Stat|undefined=undefined;
    let drawCallback: () => void;

    getLocalGame().setState(new VGuiState(getLocalGame(), oldStates, {
        onEnd: (self: VGuiState) => {},
        init: (self: VGuiState) => {
            getLocalGame().changeView(sideTernary(card.getSide(), ViewType.FIELDS_A, ViewType.FIELDS_B));

            for(const field of sideTernary(card.getSide(), getLocalGame().fieldsA, getLocalGame().fieldsB)){
                toRemove.push(field.addClickListener(()=>{
                    const card = field.getCard();
                    if(card !== undefined && card.logicalCard.cardData.species === Species.CANINE && !attackWith.delete(card)) {
                        attackWith.add(card);
                        card.highlight(true, og001Highlight);
                    }else if(card !== undefined){
                        card.highlight(false, og001Highlight);
                    }
                }));
            }
            for(const field of sideTernary(card.getSide(), getLocalGame().fieldsB, getLocalGame().fieldsA)){
                toRemove.push(field.addClickListener(()=>{
                    if(attacking) attacking.highlight(false, og001Highlight);
                    attacking = field.getCard();
                    if(attacking) attacking.highlight(true, og001Highlight);
                }));
            }

            drawCallback = registerDrawCallback(0, (p5, scale)=>{
                self.statButtons(p5, scale,
                    (stat)=>attackStat=stat,
                    (stat)=>attackStat === stat,
                    (stat)=>[...attackWith.values()].map(card=>card.logicalCard
                        .stat(stat) ?? 0).reduce((a,c)=>a+c,0).toString());

                self.buttonAndCancel(p5, scale, ()=>{
                    network.sendToServer(new CardAction({
                        cardId:card.logicalCard.id,
                        actionName:CardActionOptions.K9_ALPHA,
                        cardData:{
                            canineFields:sideTernary(card.getSide(), getLocalGame().fieldsA, getLocalGame().fieldsB)
                                .map(field => attackWith.has(field.getCard()!)),
                            attack:sideTernary(card.getSide(), getLocalGame().getGame().fieldsB, getLocalGame().getGame().fieldsA)
                                .indexOf(attacking!.logicalCard)+1 as 1|2|3,
                            attackWith:attackStat
                        }
                    })).onReply(successOrFail(()=>{
                        animation(async ()=>{
                            let particles = [];
                            for(const field of sideTernary(card.getSide(), getLocalGame().fieldsA, getLocalGame().fieldsB)
                                .filter(field => attackWith.has(field.getCard()!))){
                                particles.push(particleStreak(
                                    field.position, card.getStatModel(attackStat!)!.getWorldPosition(new Vector3()),
                                    whiteColor, statTernary(attackStat!, redStatColor, blueStatColor, yellowStatColor)
                                    ));
                            }
                            await Promise.all(particles);
                        });
                        lastAction();
                    },()=>{},()=>{
                        getLocalGame().changeView(sideTernary(card.getSide(), ViewType.BOARD_A, ViewType.BOARD_B));
                        for(const remove of toRemove) remove();
                        drawCallback();

                        for(const field of [...getLocalGame().fieldsA, ...getLocalGame().fieldsB])
                            field.getCard()?.highlight(false, og001Highlight);
                        attacking?.highlight(false, og001Highlight);

                        toReturn.resolve(true);
                    }));
                }, "Attack", attacking===undefined || attackStat === undefined, false);
                self.infoText(p5, scale, "Select any number of your Canine cards to attack with, select a stat to attack with, " +
                    "and select which of the opponent's cards to attack. ");
            })
        },
    }), oldStates[1]);

    return toReturn;
};
visualCardClientActions["og-018"] = async (card) =>{
    if(card.logicalCard.getMiscData(CardMiscDataStrings.ALREADY_ACTIONED) === true) return new Promise(r=>r(false));

    const toReorder = sideTernary(card.getSide(), getLocalGame().deckA, getLocalGame().deckB).getCards().slice(-2);
    if(toReorder.length === 0) return false;
    const toReturn = externalPromise<boolean>();

    network.sendToServer(new ClarifyCardEvent({
        id:card.logicalCard.id,
        justification:ClarificationJustification.AMBER
    })).onReply(()=>{
        tempHowToUse("Amber", "Click the card you want to keep; don't click the card you want to discard");
        let release:()=>void;
        let discardFirst=true;
        getLocalGame().setState(new VGuiState(getLocalGame(), [getLocalGame().state, getLocalGame().getGame().state], {
            onEnd:(self)=>{release();

                card.logicalCard.setMiscData(CardMiscDataStrings.ALREADY_ACTIONED, true);
                network.sendToServer(new CardAction({
                    cardId: card.logicalCard.id,
                    actionName: CardActionOptions.AMBER_PICK,
                    cardData: {
                        which: discardFirst ? AmberData.KEEP_SECOND : AmberData.KEEP_FIRST
                    }
                }));
                toReturn.resolve(true);
            },
            init:(self)=>{
                self.addCards(toReorder.map((card,i)=>{return{
                    card, position:new Vector2(i*6-3, 0)
                }}), (card)=>{
                    for(const other of self.cards)
                        other.position.multiply(new Vector3(-1,1,1));
                    discardFirst=!discardFirst;
                });

                self.blackBg(true);

                release = registerDrawCallback(0, (p5, scale)=>{
                    p5.textSize(scale*50/128/2.5);
                    p5.textAlign(p5.CENTER,p5.CENTER);
                    p5.text("Keep",p5.width/2-scale/2,p5.height/2-scale/2);
                    p5.text("Discard",p5.width/2+scale/2,p5.height/2-scale/2);

                    self.finishButton(p5, scale, false);
                });
            }
        }),getLocalGame().getGame().state);
    });
    return toReturn;
};
const kibbyHighlightLock = newHighlightLock();
visualCardClientActions["og-028"] = (card)=>{
    if(card.logicalCard.hasAttacked) return new Promise(r=>r(false));

    tempHowToUse("Kibby Otes", "Click the cards you want to scare, then press Finish. Then, select the cards you want " +
        "to replace them with, and press Finish again.")

    const toReturn = externalPromise<boolean>();

    const myFields = sideTernary(card.getSide(), getLocalGame().fieldsA, getLocalGame().fieldsB);
    const myHand = sideTernary(getLocalGame().getMySide(), getLocalGame().handA, getLocalGame().handB);
    const oldStates:[VisualGameState<any>, GameState]=[getLocalGame().state, getLocalGame().getGame().state];
    const replaceMap:[VisualCard|undefined,VisualCard|undefined,VisualCard|undefined] = [undefined,undefined,undefined];
    const listeners:(()=>void)[]=[];

    let release:()=>void;
    const state = new VGuiState(getLocalGame(), oldStates, {
        onEnd:(self, type)=>{
            release();
            for(const other of sideTernary(getLocalGame().getMySide(), getLocalGame().handA, getLocalGame().handB).cards)
                other.highlight(false, kibbyHighlightLock);
            for(const other of replaceMap) {
                if(other) myHand.addCard(other);
                other?.highlight(false, kibbyHighlightLock);
            }
            getLocalGame().selectedCard?.highlight(false, kibbyHighlightLock);

            for(const release of listeners) release();

            if(type ==="finished"){
                network.sendToServer(new CardAction({
                    cardId:card.logicalCard.id,
                    actionName:CardActionOptions.KIBBY_SCARE,
                    cardData:{cards:replaceMap.map(v=>v?.logicalCard.id ?? false) as [number|false,number|false,number|false]}
                })).onReply(successOrFail(()=>{
                    lastAction();
                    toReturn.resolve(true);
                }));
            }
        },
        init:(self)=>{
            getLocalGame().changeView(sideTernary(getLocalGame().getMySide(), ViewType.CLOSE_BOARD_A, ViewType.CLOSE_BOARD_B));
            for(let i=0;i<myFields.length;i++)
                listeners.push(myFields[i]!.addClickListener(()=>{
                    if(getLocalGame().selectedCard === undefined){
                        if(replaceMap[i] !== undefined)
                            myHand.addCard(replaceMap[i]!);
                        replaceMap[i] = undefined;
                        return;
                    }

                    const card = myFields[i]!.getCard();
                    if(!card) return;

                    if(replaceMap[i] !== undefined)
                        myHand.addCard(replaceMap[i]!);

                    replaceMap[i] = getLocalGame().selectedCard;
                    getLocalGame().selectedCard = undefined;
                    replaceMap[i]!.position = myFields[i]!.position.clone().add(new Vector3(0,20,0));
                }));
            self.addFeatures(StateFeatures.FIELDS_SELECTABLE)
            for(const other of myHand.cards){
                if(self.canSelectHandCard(other))
                    other.highlight(true, kibbyHighlightLock);
            }

            release = registerDrawCallback(0,(p5,scale)=>{
                self.finishAndCancel(p5, scale, !replaceMap.some(v=>v!==undefined), false);
                self.infoText(p5, scale, "Scare your field cards by placing hand cards on top of them")
            });
        },
        canSelectHandCard:(self, card)=>{
            return card.logicalCard.cardData.level === 3;
        }
    });

    // const state = new VPickCardsState(getLocalGame(), oldStates,
    //     fields.map(field=>field.getCard()).filter(card=>card!==undefined),
    //     (picked)=>{
    //         if(toScare.has(picked.logicalCard.id)) toScare.delete(picked.logicalCard.id);
    //         else toScare.add(picked.logicalCard.id);
    //
    //         state.endType = (toScare.size <= sideTernary(card.getSide(), getLocalGame().handA, getLocalGame().handB).cards
    //             .filter(card=>card.logicalCard.cardData.level === 3).length &&
    //             toScare.size >=1)?EndType.BOTH:EndType.CANCEL;
    //     }, EndType.CANCEL, ()=>{
    //         if(toScare.size===0) return resolve!(true);
    //
    //         const toReplace:number[] = [];
    //         const state2 = new VPickCardsState(getLocalGame(), oldStates,
    //             sideTernary(card.getSide(), getLocalGame().handA, getLocalGame().handB).cards
    //                 .filter(card=>card.logicalCard.cardData.level === 3),
    //             (picked)=>{
    //                 if(toReplace.indexOf(picked.logicalCard.id) !== -1)
    //                     toReplace.splice(toReplace.indexOf(picked.logicalCard.id),1);
    //                 else toReplace.push(picked.logicalCard.id);
    //
    //                 state2.endType = toScare.size === toReplace.length ? EndType.BOTH : EndType.CANCEL;
    //             },EndType.CANCEL,()=>{
    //                 let toSend:[number|false,number|false,number|false] = [false,false,false];
    //                 for(let i=0;i<3;i++){
    //                     if(toScare.has(fields[i]!.getCard()?.logicalCard.id ?? -1))
    //                         toSend[i] = toReplace.pop()!;
    //                 }
    //
    //                 network.sendToServer(new CardAction({
    //                     cardId:card.logicalCard.id,
    //                     actionName:CardActionOptions.KIBBY_SCARE,
    //                     cardData:{cards:toSend}
    //                 }));
    //                 resolve!(true);
    //             });
    //         getLocalGame().setState(state2, getLocalGame().getGame().state);
    //     });
    getLocalGame().setState(state, getLocalGame().getGame().state);

    return toReturn;
};
visualCardClientActions["og-038"] = (card)=>{
    tempHowToUse("Worick the Wild Whisperer", "Click the card to add to your hand.");

    const cards = sideTernary(card.getSide(), getLocalGame().runawayA, getLocalGame().runawayB).getCards()
        .filter(card => card?.logicalCard.cardData.level === 1);
    const toReturn = externalPromise<boolean>();
    if(cards.length===0) {
        toReturn.resolve(false);
        return toReturn;
    }
    getLocalGame().setState(new VPickCardsState(getLocalGame(), [getLocalGame().state, getLocalGame().getGame().state],
        cards, (picked)=>{
            getLocalGame().frozen=true;
            network.sendToServer(new CardAction({
                cardId:card.logicalCard.id,
                actionName:CardActionOptions.WORICK_RESCUE,
                cardData:{
                    id:picked.logicalCard.id
                }
            })).onReply(successOrFail(()=>{
                sideTernary(card.getSide(), getLocalGame().handA, getLocalGame().handB).addCard(picked);
                lastAction();
                (getLocalGame().state as VPickCardsState).end();
            },()=>{},()=>{
                getLocalGame().frozen=false;
                toReturn.resolve(true);
            }));
        }, EndType.BOTH),
        getLocalGame().getGame().state);
    return toReturn;
};
const og041Highlight = newHighlightLock();
visualCardClientActions["og-041"] = (card)=>{
    if(card.logicalCard.getMiscData(CardMiscDataStrings.ALREADY_ACTIONED) === true) return new Promise(r=>r(false));

    if(sideTernary(card.getSide(), card.game.getGame().deckA, card.game.getGame().deckB).length<=0)
        return new Promise<boolean>(r=>r(true));

    tempHowToUse("Fur Maker", "Click the card to add to your hand");
    const toReturn = externalPromise<boolean>();

    waitForClarify(ClarificationJustification.FURMAKER, ()=>{
        let release:()=>void;
        let selectedCard:VisualCard|undefined=undefined;
        getLocalGame().setState(new VGuiState(getLocalGame(), [getLocalGame().state, getLocalGame().getGame().state], {
            onEnd:(self)=>{
                getLocalGame().frozen=true;
                card.logicalCard.setMiscData(CardMiscDataStrings.ALREADY_ACTIONED, true);
                network.sendToServer(new CardAction({
                    cardId:card.logicalCard.id,
                    actionName: CardActionOptions.FURMAKER_PICK,
                    cardData: {id:selectedCard!.logicalCard.id},
                })).onReply(successOrFail(()=>{},()=>{},()=>{
                    getLocalGame().frozen=false;
                    toReturn.resolve(true);
                }));

                release();
            },
            init:(self)=>{
                const cards = sideTernary(card.getSide(), card.game.deckA, card.game.deckB).getCards();
                let height=1;
                let scale=0.9;

                if(cards.length>4) height=2;
                if(cards.length>8 && cards.length%3 === 0) height=3;
                if(cards.length === 13 || cards.length === 16) height=3;

                const cardPositions:Vector2[] = [];
                let currCard=0;
                let width = Math.floor(cards.length/height);
                for(let y=0;y<height;y++){
                    let adjWidth = width + (y === 1 ? 1 : 0);
                    for(let x=0;x<adjWidth;x++){
                        if(cards[currCard] === undefined) break;
                        cardPositions[currCard] = new Vector2((x-(adjWidth-1)/2)*scale*4, -(y-(height-0.5)/2)*scale*5.5);
                        currCard++;
                    }
                }

                self.addCards(cards.map((card, i)=>{
                    return {
                        card,
                        position:cardPositions[i]!,
                        scale
                    }
                }), (card)=>{
                    selectedCard?.highlight(false, og041Highlight);
                    selectedCard = card;
                    selectedCard?.highlight(true, og041Highlight);
                });

                release=registerDrawCallback(0,(p5,scale)=>{
                    self.finishButton(p5, scale, selectedCard===undefined);
                })
            }
        }),getLocalGame().getGame().state);
    });

    network.sendToServer(new ClarifyCardEvent({
        id:card.logicalCard.id,
        justification:ClarificationJustification.FURMAKER,
    }));

    return toReturn;
};

//--

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardTriggerType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}
function waitToDraw(data:CardData){
    wrap(data, CardTriggerType.PRE_PLACED, (orig, {self, game})=>{
        if(orig) orig({self, game});
        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)!.waiting=true;
    });
}

waitToDraw(cards["og-005"]!);
wrap(cards["og-005"]!, CardTriggerType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    tempHowToUse("Brownie","Click the card you want to add to your hand")
    network.sendToServer(new ClarifyCardEvent({
        id:self.id,
        justification:ClarificationJustification.BROWNIE,
    })).onReply(successOrFail(()=>{
        const cards = sideTernary(self.side, game.deckA, game.deckB).filter(card =>
            card.cardData.level === 1 && card.isAlwaysFree());
        getLocalGame().setState(new VPickCardsState(getLocalGame(), [getLocalGame().state, (game.state as TurnState)], getLocalGame().elements.filter(element =>
            VisualCard.getExactVisualCard(element) && cards.some(card => (element as VisualCard).logicalCard.id === card.id)) as VisualCard[], (card)=>{

            const state = getLocalGame().state as VPickCardsState;
            state.cards.splice(state.cards.indexOf(card),1)[0]?.removeFromScene();

            const deck = sideTernary(card.getSide(), getLocalGame().deckA, getLocalGame().deckB);
            const toRemove =deck.getCards().find(c => c.logicalCard.id === card.logicalCard.id);
            if(toRemove) {
                deck.removeCard(toRemove);
                toRemove.setRealPosition(card.position.clone());
                toRemove.setRealRotation(card.rotation.clone());
                toRemove.flipFaceup();
                sideTernary(card.getSide(), getLocalGame().handA, getLocalGame().handB).addCard(toRemove);
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

            state.end();
        }, EndType.NONE), game.state);
    }));
});
waitToDraw(cards["og-009"]!);
const og009Highlight = newHighlightLock();
wrap(cards["og-009"]!, CardTriggerType.PLACED, (orig, {self:card, game}) =>{
    if(orig) orig({self:card, game});

    const target=sideTernary(card.side, game.fieldsB, game.fieldsA).filter(card => card !== undefined);
    if(target.length>=2 &&//if there are at least 2 cards on opponent field
        target.some(card => //and at least one card has at least 1 stat less than 2
            ((card.stat(Stat.RED)??99)<2 || (card.stat(Stat.BLUE)??99)<2 || (card.stat(Stat.YELLOW)??99)<2))) {

        tempHowToUse("Gremlin Kitten", "Select the card to scare");
        let selectedCard:1|2|3|undefined;
        let releases:(()=>void)[] = [];
        const fields = sideTernary(getLocalGame().getMySide(), getLocalGame().fieldsB, getLocalGame().fieldsA);
        let prevPos:Vector3;
        getLocalGame().setState(new VGuiState(getLocalGame(), [getLocalGame().state, getLocalGame().getGame().state],{
            onEnd:(self,type)=>{
                for(const field of sideTernary(getLocalGame().getMySide(), getLocalGame().fieldsB, getLocalGame().fieldsA))
                    field.getCard()?.highlight(false, og009Highlight);
                for(const release of releases) release();
                sideTernary(getLocalGame().getMySide(), getLocalGame().handB, getLocalGame().handA).position = prevPos;

                if(type === "finished")
                    network.sendToServer(new CardAction({cardId:card.id, actionName:CardActionOptions.GREMLIN_SCARE, cardData:{
                        position:selectedCard!
                    }}));
            },
            init:(self)=>{
                getLocalGame().changeView(sideTernary(getLocalGame().getMySide(), ViewType.CLOSER_BOARD_B, ViewType.CLOSER_BOARD_A));
                prevPos = sideTernary(getLocalGame().getMySide(), getLocalGame().handB, getLocalGame().handA).position;
                sideTernary(getLocalGame().getMySide(), getLocalGame().handB, getLocalGame().handA).position =
                    prevPos.clone().add(new Vector3(0,-300,0));

                for(const field of fields){
                    releases.push(field.addClickListener(()=>{
                        for(const stat of [Stat.RED, Stat.BLUE, Stat.YELLOW])
                            if((field.getCard()?.logicalCard.stat(stat) ?? 99)<2){
                                fields[(selectedCard ?? 0) - 1]?.getCard()?.highlight(false, og009Highlight);
                                selectedCard = field.which;
                                fields[(selectedCard ?? 0) - 1]?.getCard()?.highlight(true, og009Highlight);
                            }
                    }));
                }

                releases.push(registerDrawCallback(0, (p5, scale)=>{
                    self.buttonAndFinish(p5, scale, ()=>self.end("canceled"), "Pass", false, selectedCard === undefined, false);
                    self.infoText(p5, scale, "Click which of your opponents cards to scare, or Pass without scaring")
                }));
            }
        }), getLocalGame().getGame().state);
    }else{
        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
    }
});
waitToDraw(cards["og-011"]!);
wrap(cards["og-011"]!, CardTriggerType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});
    game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
});
wrap(cards["og-018"]!, CardTriggerType.TURN_START, (orig, {self, game})=>{
    if(orig) orig({self, game});

    self.setMiscData(CardMiscDataStrings.ALREADY_ACTIONED, false);
});
wrap(cards["og-027"]!, CardTriggerType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    tempHowToUse("Yashi MauMau", "Select your three cards, then press Finish. "+
        "Click the cards in order of top to bottom: the first card will be on top of " +
        "the deck and the last card will be third (or second or whatever)");
    waitForClarify(ClarificationJustification.YASHI, ()=>{
        getLocalGame().frozen=false;

        let toSend:[number?,number?,number?] = [];
        const origState = getLocalGame().state;
        const firstState = new VPickCardsState(getLocalGame(), [origState, game.state],
            sideTernary(self.side, getLocalGame().deckA, getLocalGame().deckB).getCards(),
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
                const toCancel = new VPickCardsState(getLocalGame(), [origState, game.state],
                    sideTernary(self.side, getLocalGame().deckA, getLocalGame().deckB).getCards()
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
                            toCancel.end();
                        }
                    },EndType.NONE);
                getLocalGame().setState(toCancel, game.state);
            })
        getLocalGame().setState(firstState, game.state);
    });
    getLocalGame().frozen=true;
});
wrap(cards["og-031"]!, CardTriggerType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    tempHowToUse("The Foxy Magician", "Pick the card you want to potentially add to your hand.")

    waitForClarify(ClarificationJustification.FOXY_MAGICIAN, ()=>{
        const state = new VPickCardsState(getLocalGame(), [getLocalGame().state,game.state],
            sideTernary(self.side, getLocalGame().deckA, getLocalGame().deckB).getCards(),
            (picked)=>{
                network.sendToServer(new CardAction({
                    cardId:self.id,
                    actionName:CardActionOptions.FOXY_MAGICIAN_PICK,
                    cardData:picked.logicalCard.id
                }));
                state.end();

                waitForClarify(ClarificationJustification.FOXY_MAGICIAN, (event)=>{
                    if(event instanceof ClarifyCardEvent && event.data.id === picked.logicalCard.id) {
                        picked.flipFaceup();
                        sideTernary(self.side, getLocalGame().handA, getLocalGame().handB).addCard(picked);
                    }
                });
            },EndType.NONE);
        getLocalGame().setState(state, game.state);
    });
});
wrap(cards["og-032"]!, CardTriggerType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    tempHowToUse("Dark Cat Wizard", "Pick any card; your opponent will try to guess its level.")

    game.freeze(()=>true);

    waitForClarify(ClarificationJustification.DCW, ()=>{
        const oldStates:[VisualGameState<any>,GameState]=[getLocalGame().state,game.state];
        const state = new VPickCardsState(getLocalGame(), oldStates,
            sideTernary(self.side, getLocalGame().deckA, getLocalGame().deckB).getCards(),
                (picked)=>{
                    network.sendToServer(new CardAction({
                        cardId:self.id,
                        actionName:CardActionOptions.DCW_PICK,
                        cardData:picked.logicalCard.id
                    }));
                    state.end();

                    waitForClarify(ClarificationJustification.DCW, (event)=>{
                        if(event instanceof ClarifyCardEvent && event.data.id === -1) {
                            tempHowToUse("Dark Cat Wizard - Scaring", "Click the card you want to scare off.")

                            //scare any card
                            const state2 = new VPickCardsState(getLocalGame(), oldStates,
                                [...getLocalGame().fieldsA, ...getLocalGame().fieldsB].map(field=>field.getCard())
                                    .filter(card=>card !== undefined),
                                (picked2)=>{
                                    network.sendToServer(new CardAction({
                                        cardId:self.id,
                                        actionName:CardActionOptions.DCW_SCARE,
                                        cardData:{
                                            side:picked2.getSide(),
                                            pos:sideTernary(picked2.getSide(), getLocalGame().fieldsA, getLocalGame().fieldsB)
                                                .findIndex(field=>field.getCard()?.logicalCard.id === picked2.logicalCard.id) + 1
                                        }
                                    })).onReply(successOrFail(()=>{
                                        game.unfreeze();
                                    },()=>{},()=>{}));
                                    state2.end();
                                },EndType.NONE);
                            getLocalGame().setState(state2, oldStates[1]);
                        }
                    });
                },EndType.NONE);
        getLocalGame().setState(state, game.state);
    });
});
wrap(cards["og-041"]!, CardTriggerType.VISUAL_TICK, (_, {self})=>{
    if(self.getMiscData(CardMiscDataStrings.FURMAKER_ALREADY_ASKED_FOR) === undefined)
        self.setMiscData(CardMiscDataStrings.FURMAKER_ALREADY_ASKED_FOR, new Set());
    if(self.side !== getLocalGame().getMySide()){
        const alreadyAskedFor = self.getMiscData(CardMiscDataStrings.FURMAKER_ALREADY_ASKED_FOR)!;
        const askFor = sideTernary(self.side, getLocalGame().handA, getLocalGame().handB).cards.filter(card=>
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
wrap(cards["og-041"]!, CardTriggerType.TURN_START, (orig, {self, game})=>{
    if(orig) orig({self, game});

    self.setMiscData(CardMiscDataStrings.ALREADY_ACTIONED, false);
});
wrap(cards["og-043"]!, CardTriggerType.PRE_PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    if(game.state instanceof BeforeGameState){
        tempHowToUse("Cloud Cat", "Whatever the opponent places will be disabled :)");
        network.sendToServer(new CardAction({
            cardId:self.id,
            actionName:CardActionOptions.CLOUD_CAT_PICK,
            cardData:1
        }));
        self.setMiscData(CardMiscDataStrings.CLOUD_CAT_ALREADY_PICKED, true);
    }
});
wrap(cards["og-043"]!, CardTriggerType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});
    if(self.getMiscData(CardMiscDataStrings.CLOUD_CAT_ALREADY_PICKED)) return;

    tempHowToUse("Cloud Cat", "Click the card to disable");
    const state = new VPickCardsState(getLocalGame(), [getLocalGame().state, game.state],
        sideTernary(self.side, getLocalGame().fieldsB, getLocalGame().fieldsA)
            .map(magnet=>magnet.getCard())
            .filter(card=>card!==undefined),
        (card)=>{
            network.sendToServer(new CardAction({
                cardId:self.id,
                actionName:CardActionOptions.CLOUD_CAT_PICK,
                cardData:sideTernary(card.getSide(), getLocalGame().fieldsA, getLocalGame().fieldsB)
                    .map(magnet=>magnet.getCard())
                    .findIndex(mCard=>mCard?.logicalCard.id === card.logicalCard.id)+1
            }));
            state.end();
        }, EndType.NONE);
    getLocalGame().setState(state, game.state);
});
