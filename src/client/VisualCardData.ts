import CardData, {CardTriggerType, type Level, Species} from "../CardData.js";
import cards from "../Cards.js";
import {VGuiState, VisualGameState, VPickCardsState, VTurnState} from "./VisualGameStates.js";
import VisualCard, {newHighlightLock} from "./VisualCard.js";
import {externalPromise, sideTernary, statTernary, wait} from "../consts.js";
import {network, successOrFail} from "../networking/Server.js";
import {CardAction, ClarificationJustification, ClarifyCardEvent,} from "../networking/Events.js";
import {CardMiscDataStrings, Stat} from "../Card.js";
import {
    AmberData,
    CardActionOptions,
    type DCW_GUESS,
    type FOXY_MAGICIAN_GUESS
} from "../networking/CardActionOption.js";
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
import {waitFor} from "../networking/LocalServer.js";
import type SuperficialVisualCard from "./SuperficialVisualCard.js";

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
    getLocalGame().setState(new VGuiState(getLocalGame(), oldStates, {
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
    }), getLocalGame().getGame().state);

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
        let selectedCard:SuperficialVisualCard|undefined=undefined;
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
                self.addCardsGrid(sideTernary(card.getSide(), card.game.deckA, card.game.deckB).getCards(), (card)=>{
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
const og027highlight = newHighlightLock();
wrap(cards["og-027"]!, CardTriggerType.PLACED, (orig, {self:card, game})=>{
    if(orig) orig({self:card, game});

    tempHowToUse("Yashi MauMau", "Select your three cards, then press Finish. "+
        "Click the cards in order of top to bottom: the first card will be on top of " +
        "the deck and the last card will be third (or second or whatever)");
    waitForClarify(ClarificationJustification.YASHI, ()=> {
        getLocalGame().frozen = false;

        let ordered: [number?, number?, number?] = [];
        let release: () => void;
        let cardsRelease:()=>void;
        const selected = new Set<SuperficialVisualCard>();
        let state:[boolean,"pick"|"order"]=[false,"pick"];
        let orderingSelected:SuperficialVisualCard|undefined;
        getLocalGame().setState(new VGuiState(getLocalGame(), [getLocalGame().state, getLocalGame().getGame().state], {
            onEnd: (self, type) => {
                release();
                network.sendToServer(new CardAction({
                    cardId:card.id,
                    actionName:CardActionOptions.YASHI_REORDER,
                    cardData:{cards:ordered},
                }));
            },
            init: (self) => {
                self.blackBg(true);
                release = registerDrawCallback(0, (p5, scale) => {
                    if(state[1] === "pick") {
                        if(!state[0]){
                            cardsRelease=self.addCardsGrid(sideTernary(getLocalGame().getMySide(), getLocalGame().deckA, getLocalGame().deckB).getCards(),
                                (picked) => {
                                    if (selected.has(picked)) {
                                        selected.delete(picked);
                                        picked.highlight(false, og027highlight);
                                    } else if(selected.size<3) {
                                        selected.add(picked);
                                        picked.highlight(true, og027highlight);
                                    }
                                });
                            for(const card of selected.values()){
                                self.cards.find(c=>c.logicalCard.id === card.logicalCard.id)?.highlight(true, og027highlight);
                            }
                        }

                        self.button(p5, scale, () => {
                            for (const vCard of self.cards)
                                vCard.removeFromScene();
                            cardsRelease();

                            ordered = [...selected.values()].map(v=>v.logicalCard.id) as [number?, number?, number?];
                            state=[false,"order"];
                        }, "Continue", selected.size === 0);
                        self.infoText(p5, scale, "Pick up to 3 cards to reorder on top of the deck");
                    }else{
                        if(!state[0]){
                            cardsRelease=self.addCardsGrid([...selected.values()],
                                (picked) => {
                                    if(!orderingSelected){
                                        orderingSelected = picked;
                                        orderingSelected.highlight(true, og027highlight);
                                    }else{
                                        [orderingSelected.position, picked.position] = [picked.position, orderingSelected.position];
                                        const p1 = ordered.indexOf(orderingSelected.logicalCard.id);
                                        const p2 = ordered.indexOf(picked.logicalCard.id);
                                        [ordered[p1], ordered[p2]] = [ordered[p2], ordered[p1]];

                                        orderingSelected.highlight(false, og027highlight);
                                        orderingSelected = undefined;
                                    }
                                });
                        }

                        self.buttonAndFinish(p5, scale, ()=>{
                            for (const vCard of self.cards)
                                vCard.removeFromScene();
                            cardsRelease();

                            state=[false,"pick"];
                        }, "Back", false, false, false);
                        self.infoText(p5, scale, "Swap the cards around to determine the new order");
                        p5.push();
                        p5.textSize(scale*50/128/2.5);
                        p5.textAlign(p5.CENTER,p5.CENTER);
                        for(let i=0;i<ordered.length;i++)
                            p5.text((["Top","Second","Third"])[i],p5.width/2 + (i-(ordered.length-1)/2)*scale*0.6,p5.height/2-scale*0.7);
                        p5.pop();
                    }

                    state[0]=true;
                })
            }
        }), getLocalGame().getGame().state);
    });
    getLocalGame().frozen=true;
});
const og031Highlight = newHighlightLock();
wrap(cards["og-031"]!, CardTriggerType.PLACED, (orig, {self:card, game})=>{
    if(orig) orig({self:card, game});

    tempHowToUse("The Foxy Magician", "Pick the card you want to potentially add to your hand.")

    waitForClarify(ClarificationJustification.FOXY_MAGICIAN, ()=>{
        let release:()=>void;
        let selectedCard:SuperficialVisualCard|undefined;
        let uiState:"pick"|"wait"|"end"="pick";
        let frame=0;
        let guess:Level|undefined;
        getLocalGame().setState(new VGuiState(getLocalGame(), [getLocalGame().state, game.state], {
            onEnd:(self, type)=>{
                release();

                if(guess!==selectedCard?.logicalCard.cardData.level){
                    const removeFrom = sideTernary(game.mySide, getLocalGame().deckA, getLocalGame().deckB);
                    const realCard = getLocalGame().elements.find(element=>element instanceof VisualCard &&
                        element.logicalCard.id === selectedCard?.logicalCard.id)! as VisualCard;
                    removeFrom.removeCard(realCard);
                    sideTernary(game.mySide, getLocalGame().handA, getLocalGame().handB)
                        .addCard(realCard);
                    realCard.flipFaceup();
                }
            },
            init:(self)=>{
                self.blackBg(true);

                release = registerDrawCallback(0, (p5, scale)=>{
                    if(uiState === "pick")
                        self.button(p5, scale, ()=>{
                            for(const other of self.cards)
                                if(other !== selectedCard) other.removeFromScene();
                                else{
                                    other.position = new Vector3(0,0,-20);
                                    other.highlight(false, og031Highlight);
                                }

                            network.sendToServer(new CardAction({
                                cardId:card.id,
                                actionName:CardActionOptions.FOXY_MAGICIAN_PICK,
                                cardData:selectedCard!.logicalCard.id
                            }));

                            uiState = "wait";
                            waitFor(event=>event instanceof CardAction && event.data.actionName === CardActionOptions.FOXY_MAGICIAN_GUESS,
                                (guessEvent)=>{
                                    guess=((guessEvent as CardAction<any>).data.cardData as FOXY_MAGICIAN_GUESS);
                                    uiState = "end";
                                    return false;
                                });
                        }, "Select", selectedCard === undefined);
                    else if(uiState === "wait"){
                        p5.push();
                        p5.textSize(scale*50/128/2.5);
                        p5.textAlign(p5.CENTER,p5.CENTER);
                        p5.text("Waiting"+".".repeat(Math.floor(frame/50)%4),p5.width/2,p5.height/2-scale*0.7);
                        frame=(frame+1)%200;
                        p5.pop();
                    }else{
                        p5.push();
                        p5.textSize(scale*50/128/2.5);
                        p5.textAlign(p5.CENTER,p5.CENTER);
                        p5.text(`Opponent guessed ${guess === selectedCard!.logicalCard.cardData.level ? "right" : "wrong" }: Level `+guess,p5.width/2,p5.height/2-scale*0.7);
                        frame=(frame+1)%200;
                        p5.pop();

                        self.finishButton(p5, scale, false);
                    }
                })

                self.addCardsGrid(sideTernary(getLocalGame().getMySide(), getLocalGame().deckA, getLocalGame().deckB).getCards(),
                    (picked)=>{
                        if(uiState === "wait") return;

                        selectedCard?.highlight(false, og031Highlight);
                        selectedCard = picked;
                        selectedCard?.highlight(true, og031Highlight);
                    });
            }
        }), game.state);
    });
});
const og032Highlight = newHighlightLock();
wrap(cards["og-032"]!, CardTriggerType.PLACED, (orig, {self:card, game})=>{
    if(orig) orig({self:card, game});

    tempHowToUse("Dark Cat Wizard", "Pick any card; your opponent will try to guess its level.")

    waitForClarify(ClarificationJustification.DCW, ()=>{
        let release:()=>void;
        let selectedCard:SuperficialVisualCard|undefined;
        let uiState:"pick"|"wait"|"end"="pick";
        let frame=0;
        let guess:Level|undefined;

        const oldState = [getLocalGame().state, game.state] satisfies [VisualGameState<any>, GameState];
        getLocalGame().setState(new VGuiState(getLocalGame(), oldState, {
            onEnd: (self, type) => {
                release();

                if (guess !== selectedCard?.logicalCard.cardData.level) {
                    let scareSelected:[VisualCard,1|2|3]|undefined;
                    let listeners:(()=>void)[]=[];
                    let release:()=>void;
                    getLocalGame().setState(new VGuiState(getLocalGame(), oldState, {
                        onEnd:(self, type)=>{
                            for(const release of listeners) release();
                            release();

                            network.sendToServer(new CardAction({
                                cardId:card.id,
                                actionName:CardActionOptions.DCW_SCARE,
                                cardData:{
                                    side:scareSelected![0].getSide(),
                                    pos:scareSelected![1]
                                }
                            })).onReply(successOrFail(()=>{
                                game.unfreeze();
                            }));
                        },
                        init:(self)=>{
                            getLocalGame().changeView(sideTernary(getLocalGame().getMySide(), ViewType.CLOSER_BOARD_A, ViewType.CLOSER_BOARD_B));

                            for(const field of [...getLocalGame().fieldsA, ...getLocalGame().fieldsB]){
                                listeners.push(field.addClickListener(()=>{
                                    const card = field.getCard();
                                    if(!card) return;
                                    scareSelected?.[0].highlight(false, og032Highlight);
                                    scareSelected = [card, field.which];
                                    scareSelected[0].highlight(true, og032Highlight);
                                }));
                            }

                            release=registerDrawCallback(0,(p5,scale)=>{
                                self.finishButton(p5, scale, scareSelected === undefined);

                                self.infoText(p5, scale, "You opponent didn't guess the card's level. Select a card to scare off");
                            });
                        }
                    }), oldState[1]);
                }
                return true;
            },
            init: (self) => {
                self.blackBg(true);

                release = registerDrawCallback(0, (p5, scale)=>{
                    if(uiState === "pick")
                        self.button(p5, scale, ()=>{
                            for(const other of self.cards)
                                if(other !== selectedCard) other.removeFromScene();
                                else{
                                    other.position = new Vector3(0,0,-20);
                                    other.highlight(false, og031Highlight);
                                }

                            network.sendToServer(new CardAction({
                                cardId:card.id,
                                actionName:CardActionOptions.DCW_PICK,
                                cardData:selectedCard!.logicalCard.id
                            }));

                            uiState = "wait";
                            waitFor(event=>event instanceof CardAction && event.data.actionName === CardActionOptions.DCW_GUESS,
                                (guessEvent)=>{
                                    guess=((guessEvent as CardAction<any>).data.cardData as DCW_GUESS);
                                    if(guess!==undefined && guess === selectedCard?.logicalCard.cardData.level)
                                        uiState = "end";
                                    else {
                                        uiState = "wait";

                                        waitFor(event=>event instanceof CardAction && event.data.actionName === CardActionOptions.DCW_GUESS,
                                            (guessEvent)=>{
                                                guess=((guessEvent as CardAction<any>).data.cardData as DCW_GUESS);
                                                uiState = "end";
                                                return false;
                                            });
                                    }
                                    return false;
                                });
                        }, "Select", selectedCard === undefined);
                    else if(uiState === "wait"){
                        p5.push();
                        p5.textSize(scale*50/128/2.5);
                        p5.textAlign(p5.CENTER,p5.CENTER);
                        if(guess !== undefined)
                            p5.text("Guessed Level "+guess,p5.width/2,p5.height/2-scale);
                        p5.text("Waiting"+".".repeat(Math.floor(frame/50)%4),p5.width/2,p5.height/2-scale*0.7);
                        frame=(frame+1)%200;
                        p5.pop();
                    }else{
                        p5.push();
                        p5.textSize(scale*50/128/2.5);
                        p5.textAlign(p5.CENTER,p5.CENTER);
                        const guessedRight = guess === selectedCard!.logicalCard.cardData.level;
                        p5.text(`Opponent guessed ${guessedRight ? "right" : "wrong" }: Level `+guess,p5.width/2,p5.height/2-scale*0.7);
                        frame=(frame+1)%200;
                        p5.pop();

                        self.button(p5, scale, ()=>self.end("finished"),guessedRight ? "Finish" : "Scare",false)
                        self.finishButton(p5, scale, false);
                    }
                })

                self.addCardsGrid(sideTernary(getLocalGame().getMySide(), getLocalGame().deckA, getLocalGame().deckB).getCards(),
                    (picked)=>{
                        if(uiState === "wait") return;

                        selectedCard?.highlight(false, og031Highlight);
                        selectedCard = picked;
                        selectedCard?.highlight(true, og031Highlight);
                    });
            }
        }), getLocalGame().getGame().state);
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
