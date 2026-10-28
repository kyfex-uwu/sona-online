import {eventReply} from "../Server.js";
import {
    CardAction,
    ClarificationJustification,
    ClarifyCardEvent,
    DetermineStarterEvent,
    DiscardAction,
    DrawAction,
    GameEvent,
    GameStartEvent,
    MultiClarifyCardEvent,
    PassAction,
    PlaceAction,
    ScareAction,
    ServerDumpEvent,
} from "../Events.js";
import Card, {getVictim} from "../../Card.js";
import VisualCard, {newHighlightLock} from "../../client/VisualCard.js";
import cards from "../../Cards.js";
import {Euler, Quaternion, Vector2, Vector3} from "three";
import VisualGame, {ViewType} from "../../client/VisualGame.js";
import {other} from "../../GameElement.js";
import {externalPromise, Side, sideTernary, statTernary, wait, WaitChain} from "../../consts.js";
import type FieldMagnet from "../../client/magnets/FieldMagnet.js";
import {VChoosingStartState, VGuiState, VTurnState} from "../../client/VisualGameStates.js";
import {
    Animations,
    blueStatColor,
    button,
    buttonId, particle,
    particleArc,
    particleStreak,
    redStatColor,
    registerDrawCallback,
    whiteColor,
    yellowStatColor
} from "../../client/ui.js";
import {BeforeGameState, TurnState} from "../../GameStates.js";
import {
    type AMBER_PICK,
    AmberData,
    type BOTTOM_DRAW,
    type BROWNIE_DRAW, type BROY_WEASLA_INCREASE,
    CardActionOptions,
    type CLOUD_CAT_PICK, type COWGIRL_COYOTE_INCREASE,
    type FURMAKER_PICK,
    type NOBLE_RETARGET,
    type WORICK_RESCUE,
    type YASHI_REORDER
} from "../CardActionOption.js";
import {GameMiscDataStrings} from "../../Game.js";
import {log, sendToServer, threeScene} from "../../client/clientConsts.js";
import {localWaiter} from "./LocalServer.js";
import {setScene} from "../../index.js";
import {GameScene} from "../../client/scenes/GameScene.js";
import SuperficialVisualCard from "../../client/SuperficialVisualCard.js";
import type {Level} from "../../CardData.js";

function clarifyCard(id:number, cardDataName?:string, faceUp?:boolean){
    const visualCard = game.elements.find(e=>VisualCard.getExactVisualCard(e)?.logicalCard.id === id) as VisualCard;
    if(visualCard === undefined || visualCard.logicalCard.id<0) return;
    if(cardDataName !== undefined)
        visualCard.logicalCard.setCardData(cards[cardDataName]!);

    if(cardDataName !== undefined){
        game.getGame().cards.delete(visualCard.logicalCard);
        visualCard.repopulate(visualCard.logicalCard);
    }

    if(faceUp !== undefined && faceUp !== visualCard.logicalCard.getFaceUp())
        visualCard[faceUp ? "flipFaceup" : "flipFacedown"]();

    game.getGame().cards.add(visualCard.logicalCard);
}
const waitingForClarify:{[k:number]:((event:ClarifyCardEvent|MultiClarifyCardEvent)=>void)[]} = {};
export function waitForClarify(justification:ClarificationJustification,
                               callback:(event:ClarifyCardEvent|MultiClarifyCardEvent)=>void){
    if(waitingForClarify[justification] === undefined)
        waitingForClarify[justification] = [];
    waitingForClarify[justification].push(callback);
}

const logColors:{[key:string]:string}= {
    DrawAction: "#88f",
    PlaceAction: "#8f8",
    ScareAction: "#f88",
    CardAction: "#ff8",
    PassAction: "#a8f",

    AcceptEvent: "#0f0",
    RejectEvent: "#f00",

    GameStartEvent: "#8ff",
    DetermineStarterEvent: "#fb8",
    ClarifyCardEvent: "#8fc"
}

const foxyMagicianLevelButtons = [buttonId(), buttonId(), buttonId()];

let game:VisualGame;
export function getLocalGame(){ return game; }
const debouncer = new WaitChain();
export async function gameReceiveFromServer(event:GameEvent<any>) {
    log("%c -> "+event.constructor.name+"\n"+event.serialize(),
        `background:${(logColors[event.constructor.name]||"#000")+"2"}; color:${logColors[event.constructor.name]||"#fff"}`);

    if(event instanceof GameStartEvent){
        game = new VisualGame(threeScene, event.data.cpuGame);

        setScene(()=>new GameScene(event.data.cpuGame));

        game.getGame().setMySide(event.data.which);
        game.changeView(sideTernary(event.data.which, ViewType.BOARD_A, ViewType.BOARD_B));
        if(game.getMySide() === Side.A){
            game.handB.setRotation(game.handB.rotation.slerp(new Quaternion().setFromEuler(new Euler(-1.7,Math.PI,0)),1));
            game.handB.position.add(new Vector3(0,100,60));
        }else{
            game.handA.setRotation(game.handA.rotation.slerp(new Quaternion().setFromEuler(new Euler(1.7,0, 0)),1));
            game.handA.position.add(new Vector3(0,100,-60));
        }

        const myDeck = sideTernary(game.getMySide(), game.deckA, game.deckB);
        const theirDeck = sideTernary(game.getMySide(), game.deckB, game.deckA);
        const rotation = new Quaternion().setFromEuler(new Euler(Math.PI/2,0,0));
        for(const cardId of event.data.deck){
            const visualCard = game.addElement(new VisualCard(game, new Card(cards.unknown!, game.getMySide(), game.getGame(), cardId),
                new Vector3(), rotation));
            myDeck.addCard(visualCard);
        }
        for(const cardId of event.data.otherDeck){
            const visualCard = game.addElement(new VisualCard(game, new Card(cards.unknown!, other(game.getMySide()), game.getGame(), cardId),
                new Vector3(), rotation));
            theirDeck.addCard(visualCard);
        }

        await wait(500);
    }else if (event instanceof ClarifyCardEvent) {
        clarifyCard(event.data.id, event.data.cardDataName, event.data.faceUp);
        if(event.data.justification !== undefined) {
            for (const callback of waitingForClarify[event.data.justification] ?? [])
                callback(event);
            waitingForClarify[event.data.justification]=[];
        }
    }else if(event instanceof MultiClarifyCardEvent){
        if(event.data !== undefined) {
            for (const id in event.data) {
                if(id==="justification") continue;
                clarifyCard(parseInt(id), event.data[id]!.cardDataName, event.data[id]!.faceUp);
            }
            if(event.data.justification !== undefined) {
                for (const callback of waitingForClarify[event.data.justification] ?? [])
                    callback(event);
                waitingForClarify[event.data.justification]=[];
            }
        }
    }else if(event instanceof DetermineStarterEvent){
        if(game.state instanceof VChoosingStartState){
            game.state.startGame(event);
        }
    }

    await Animations.end();
    debouncer.run(() => new Promise<void>(async r => {
        await wait(0);
        gameReceiveFromServerVisible(event);
        await wait(100);
        r();
    }));

    if(event instanceof ServerDumpEvent){
        console.log("Server game:",event.data);
    }
}

function gameReceiveFromServerVisible(event:GameEvent<any>){
    if(event instanceof PlaceAction){
        const card =  game.elements.find(element =>
            VisualCard.getExactVisualCard(element)?.logicalCard.id === event.data.cardId) as VisualCard;
        card.getHolder()?.removeCard(card);
        card.removeFromHolder();
        (sideTernary(event.data.side, game.fieldsA, game.fieldsB)[event.data.position-1] as FieldMagnet)
            .addCard(card);
        if(!(game.state.getNonVisState() instanceof BeforeGameState)) card.flipFaceup();
        else card.flipFacedown();
        if(!(event.data.forFree ?? false)){
            game.state.decrementTurn();
        }
    }else if(event instanceof DrawAction){
        sideTernary(event.data.side ?? game.getMySide(), game.deckA, game.deckB).drawCard();

        const logicalState = game.state.getNonVisState();
        if(logicalState instanceof TurnState) logicalState.setDrawnToStart();
        if(event.data.isAction !== false){
            game.state.decrementTurn();
        }
    }else if(event instanceof PassAction){
        console.log("passing?")
        Animations.run(async ()=>{
            console.log("fish")
            game.state.decrementTurn(true);
            if(game.state instanceof VTurnState) console.log(game.state.currTurn, game.state.getNonVisState().turn)
        });
    }else if(event instanceof ScareAction){
        const scaredPos = event.data.failed ? event.data.scarerPos : event.data.scaredPos;
        const scared = sideTernary(scaredPos[1], game.fieldsA, game.fieldsB)[scaredPos[0]-1]!.getCard();
        if (scared !== undefined) {
            if(event.data.failed !== true)
                Animations.run(async ()=>{
                    await particleStreak(
                        sideTernary(event.data.scarerPos[1], game.fieldsA, game.fieldsB)[event.data.scarerPos[0]-1]!.position,
                        sideTernary(event.data.scaredPos[1], game.fieldsA, game.fieldsB)[event.data.scaredPos[0]-1]!.position,
                        event.data.attackingWith === "card" ? whiteColor : statTernary(event.data.attackingWith, redStatColor,blueStatColor,yellowStatColor),
                        event.data.attackingWith === "card" ? whiteColor : statTernary(getVictim(event.data.attackingWith), redStatColor,blueStatColor,yellowStatColor),
                    ).then(()=>{
                        if(event.data.extra?.shouldRunaway)
                            sideTernary(scared.getSide(), game.runawayA, game.runawayB).addCard(scared);
                    });
                });
            else{
                if(event.data.extra?.shouldRunaway)
                    sideTernary(scared.getSide(), game.runawayA, game.runawayB).addCard(scared);
                //todo: animation
            }
        }
        const maybeAttacked = sideTernary(event.data.scarerPos[1], game.fieldsA, game.fieldsB)[event.data.scarerPos[0]-1]?.getCard()?.logicalCard;
        if(maybeAttacked) maybeAttacked.hasAttacked=true
        game.frozen=false;//todo: this is not how it should be solved
        if(!event.data.free){
            game.state.decrementTurn();
        }
    }else if(event instanceof CardAction){
        switch(event.data.actionName){
            case CardActionOptions.BOTTOM_DRAW:{
                const data = (event as CardAction<BOTTOM_DRAW>).data.cardData;
                sideTernary(data.side, game.deckA, game.deckB).drawCard(true);
            }break;
            case CardActionOptions.BROWNIE_DRAW: {
                const data = (event as CardAction<BROWNIE_DRAW>).data.cardData;
                const card = game.elements.find(element => VisualCard.getExactVisualCard(element) &&
                    (element as VisualCard).logicalCard.id === data.id) as VisualCard;
                if (card) {
                    sideTernary(card.logicalCard.side, game.deckA, game.deckB).removeCard(card);
                    sideTernary(card.logicalCard.side, game.handA, game.handB).addCard(card);
                    card.flipFaceup();
                    sideTernary(card.logicalCard.side, game.deckA, game.deckB).shuffle();
                }
            }break;
            case CardActionOptions.AMBER_PICK:{
                const data = (event as CardAction<AMBER_PICK>).data.cardData;

                const toReorder = sideTernary(data.side!, game.deckA, game.deckB).getCards();
                let [card1, card2] = [toReorder.at(-1), toReorder.at(-2)];
                if(data!.which === AmberData.KEEP_SECOND) [card1, card2] = [card2, card1];
                card1?.flipFaceup();
                card2?.flipFaceup();
                if(card1 !== undefined) sideTernary(data.side!, game.handA, game.handB).addCard(card1);
                if(card2 !== undefined) sideTernary(data.side!, game.runawayA, game.runawayB).addCard(card2);
                game.state.decrementTurn();
            }break;
            case CardActionOptions.WORICK_RESCUE:{
                const data = (event as CardAction<WORICK_RESCUE>).data.cardData;

                const removeFrom = sideTernary(data.side!, game.runawayA, game.runawayB);
                const cardToRemove = game.elements.find(element =>
                    VisualCard.getExactVisualCard(element) !== undefined &&
                    element instanceof VisualCard && element.logicalCard.id === data.id) as VisualCard;
                removeFrom.removeCard(cardToRemove);
                sideTernary(data.side!, game.handA, game.handB).addCard(cardToRemove);
            }break;
            case CardActionOptions.FURMAKER_PICK:{
                const data = (event as CardAction<FURMAKER_PICK>).data.cardData;

                const removeFrom = sideTernary(data.side!, game.deckA, game.deckB);
                const cardToRemove = game.elements.find(element =>
                    VisualCard.getExactVisualCard(element) !== undefined &&
                    element instanceof VisualCard && element.logicalCard.id === data.id) as VisualCard;
                removeFrom.removeCard(cardToRemove);
                cardToRemove.flipFaceup();
                sideTernary(data.side!, game.handA, game.handB).addCard(cardToRemove);
                sideTernary(data.side!, game.deckA, game.deckB).shuffle();
            }break;
            case CardActionOptions.YASHI_REORDER:{
                const data = (event as CardAction<YASHI_REORDER>).data.cardData;

                const deckDrawFrom = sideTernary(data.side!, game.deckA, game.deckB);
                const cards = deckDrawFrom.getCards();
                for(const card of data.cards.map(id=>cards.find(card=>card.logicalCard.id === id))
                    .reverse()){
                    if(card === undefined) continue;

                    deckDrawFrom.removeCard(card);
                    deckDrawFrom.addCard(card);
                }
            }break;
            case CardActionOptions.CLOUD_CAT_PICK:{
                game.getGame().getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![game.getMySide()] =
                    game.getGame().state instanceof BeforeGameState ? "first" :
                        sideTernary(game.getMySide(), game.fieldsA, game.fieldsB)[(event as CardAction<CLOUD_CAT_PICK>).data.cardData-1]!.getCard()!.logicalCard.id;
            }break;
            case CardActionOptions.DCW_GUESS:{
                let guess:Level;
                const endWaiter = externalPromise();
                const buttons = (p5:any, scale:number, disabled:boolean)=>{
                    for (let i = 0; i < 3; i++)
                        button(p5, p5.width / 2 + scale * (i - 1) - scale * 0.3, p5.height / 2 + scale * 0.6, scale * 0.6, scale * 0.6, i + 1 + "", () => {
                            sendToServer(new CardAction({
                                cardId: -1,
                                actionName: CardActionOptions.DCW_GUESS,
                                cardData: (i + 1 as Level)
                            }));
                            guess=i+1;

                            localWaiter.waitFor(event=>event instanceof CardAction && event.data.actionName === CardActionOptions.DCW_GUESS,
                                (guessEvent)=>{
                                    state = (guessed === undefined) ? "guess" : "end";
                                    guessed=i+1;
                                    Animations.run(()=>endWaiter);
                                    return false;
                                });

                            state="wait";
                        }, scale, foxyMagicianLevelButtons[i]!, disabled || guessed === i+1);
                }

                let release:()=>void;
                let state:"guess"|"wait"|"end"="guess";
                let guessed:Level|undefined=undefined;
                let frame=0;
                let repopulating=false;
                const targetCard = game.elements.find(card=>card instanceof SuperficialVisualCard &&
                    card.logicalCard.id === event.data.cardId) as VisualCard;
                game.setState(new VGuiState(game, [game.state, game.getGame().state], {
                    onEnd:(self,type)=>{
                        release();
                        endWaiter.resolve();
                        sideTernary(game.getMySide(), game.deckB, game.deckA).shuffle();
                    },
                    init:(self)=>{
                        self.blackBg(true);

                        self.addCards([{
                            card:"unknown.jpg",
                            position: new Vector2(0,0),
                        }],()=>{});
                        self.cards[0]!.flipFacedown();

                        release = registerDrawCallback(0,(p5, scale)=>{
                            if(!repopulating && targetCard.logicalCard.cardData.name!=="unknown") {
                                repopulating=true;
                                state="end";
                                self.cards[0]!.repopulate(new Card(targetCard.logicalCard.cardData,
                                    Side.A, null!,-1).flipFacedown()).then(()=>{
                                    self.cards[0]!.flipFaceup();
                                });
                            }

                            if(state === "guess") {
                                p5.push();
                                p5.textSize(scale * 50 / 128 / 2.5);
                                p5.textAlign(p5.CENTER, p5.CENTER);
                                p5.text("Guess the card's level", p5.width / 2, p5.height / 2 - scale * 0.7);
                                p5.pop();

                                buttons(p5, scale, false);

                            }else if(state === "wait"){
                                p5.push();
                                p5.textSize(scale*50/128/2.5);
                                p5.textAlign(p5.CENTER,p5.CENTER);
                                p5.text("Waiting"+".".repeat(Math.floor(frame/50)%4),p5.width/2,p5.height/2-scale*0.7);
                                frame=(frame+1)%200;
                                p5.pop();

                                buttons(p5, scale, true);
                            }else{
                                p5.push();
                                p5.textSize(scale*50/128/2.5);
                                p5.textAlign(p5.CENTER,p5.CENTER);
                                p5.text("You guessed "+(targetCard.logicalCard.cardData.level === guess ? "right" : "wrong"),
                                    p5.width/2,p5.height/2-scale*0.7);
                                frame=(frame+1)%200;
                                p5.pop();

                                self.finishButton(p5, scale, false);
                            }
                        })
                    }
                }), game.getGame().state);
            }break;
            case CardActionOptions.FOXY_MAGICIAN_GUESS:{
                let guess:Level;
                const endWaiter = externalPromise();
                const buttons = (p5:any, scale:number, disabled:boolean)=>{
                    for (let i = 0; i < 3; i++)
                        button(p5, p5.width / 2 + scale * (i - 1) - scale * 0.3, p5.height / 2 + scale * 0.6, scale * 0.6, scale * 0.6, i + 1 + "", () => {
                            sendToServer(new CardAction({
                                cardId: -1,
                                actionName: CardActionOptions.FOXY_MAGICIAN_GUESS,
                                cardData: (i +1) as Level
                            }));
                            guess=i+1;

                            localWaiter.waitFor(event=>event instanceof CardAction && event.data.actionName === CardActionOptions.FOXY_MAGICIAN_GUESS,
                                (guessEvent)=>{
                                    state = "end";
                                    Animations.run(()=>endWaiter);
                                    return false;
                                });

                            state="wait";
                        }, scale, foxyMagicianLevelButtons[i]!, disabled);
                }

                let release:()=>void;
                let state:"guess"|"wait"|"end"="guess";
                let frame=0;
                let repopulating=false;
                const targetCard = game.elements.find(card=>card instanceof SuperficialVisualCard &&
                    card.logicalCard.id === event.data.cardId) as VisualCard;
                game.setState(new VGuiState(game, [game.state, game.getGame().state], {
                    onEnd:(self,type)=>{
                        release();
                        endWaiter.resolve();
                        sideTernary(game.getMySide(), game.deckB, game.deckA).shuffle();
                    },
                    init:(self)=>{
                        self.blackBg(true);

                        self.addCards([{
                            card:"unknown.jpg",
                            position: new Vector2(0,0),
                        }],()=>{});
                        self.cards[0]!.flipFacedown();

                        release = registerDrawCallback(0,(p5, scale)=>{
                            if(state === "guess") {
                                p5.push();
                                p5.textSize(scale * 50 / 128 / 2.5);
                                p5.textAlign(p5.CENTER, p5.CENTER);
                                p5.text("Guess the card's level", p5.width / 2, p5.height / 2 - scale * 0.7);
                                p5.pop();

                                buttons(p5, scale, false);

                            }else if(state === "wait"){
                                p5.push();
                                p5.textSize(scale*50/128/2.5);
                                p5.textAlign(p5.CENTER,p5.CENTER);
                                p5.text("Waiting"+".".repeat(Math.floor(frame/50)%4),p5.width/2,p5.height/2-scale*0.7);
                                frame=(frame+1)%200;
                                p5.pop();

                                buttons(p5, scale, true);
                            }else{
                                if(!repopulating && targetCard.logicalCard.cardData.name!=="unknown") {
                                    repopulating=true;
                                    self.cards[0]!.repopulate(new Card(targetCard.logicalCard.cardData,
                                        Side.A, null!,-1).flipFacedown()).then(()=>{
                                        self.cards[0]!.flipFaceup();
                                    });

                                    if(targetCard.logicalCard.cardData.level !== guess) {
                                        const removeFrom = sideTernary(getLocalGame().getMySide(), getLocalGame().deckB, getLocalGame().deckA);
                                        const realCard = getLocalGame().elements.find(element => element instanceof VisualCard &&
                                            element.logicalCard.id === event.data.cardId)! as VisualCard;
                                        removeFrom.removeCard(realCard);
                                        sideTernary(getLocalGame().getMySide(), getLocalGame().handB, getLocalGame().handA)
                                            .addCard(realCard);
                                        realCard.flipFaceup();
                                    }
                                }

                                p5.push();
                                p5.textSize(scale*50/128/2.5);
                                p5.textAlign(p5.CENTER,p5.CENTER);
                                p5.text("You guessed "+(targetCard.logicalCard.cardData.level === guess ? "right" : "wrong"),
                                    p5.width/2,p5.height/2-scale*0.7);
                                frame=(frame+1)%200;
                                p5.pop();

                                self.finishButton(p5, scale, false);
                            }
                        })
                    }
                }), game.getGame().state);
            }break;
            case CardActionOptions.LITTLEBOSS_IMMUNITY:{
                let release:()=>void;
                game.setState(new VGuiState(game, [game.state, game.getGame().state],{
                    onEnd:(self, type)=>{
                        release();
                    },
                    init:(self)=>{
                        const end = (save:boolean)=>{
                            sendToServer(new CardAction({
                                cardId:-1,
                                actionName:CardActionOptions.LITTLEBOSS_IMMUNITY,
                                cardData:save
                            }));
                            self.end("finished");
                        }
                        game.changeView(sideTernary(game.getMySide(), ViewType.FIELDS_A, ViewType.FIELDS_B));
                        const pos = sideTernary(game.getMySide(), game.fieldsA, game.fieldsB)
                            .find(v=>v.getCard()?.logicalCard.cardData.name === "og-015")
                            ?.getCard()?.model.position;
                        release=registerDrawCallback(0,(p5,scale)=>{
                            self.twoButtons(p5,scale,{
                                onClick:()=>end(true),
                                text:"Save"
                            },{
                                onClick:()=>end(false),
                                text:"Scare"
                            });
                            if(pos) particle(pos, new Vector3(Math.random(),Math.random(),Math.random()).sub(new Vector3(0.5,0.5,0.5)).multiplyScalar(4), 0.99,[
                                {
                                    time: 0,
                                    size: 0,
                                    opacity: 0,
                                    color: whiteColor,
                                },{
                                    time: 700+Math.random()*200,
                                    size: 8+Math.random()*3,
                                    opacity: 1,
                                    color: whiteColor,
                                },{
                                    time: 1200+Math.random()*500,
                                    size: 3+Math.random(),
                                    opacity: 0,
                                    color: whiteColor,
                                }
                            ])
                            self.infoText(p5,scale,"Chose whether to keep Little Boss on the field or let it be scared");
                        })
                    }
                }), game.getGame().state);
            }break;
            case CardActionOptions.COWGIRL_COYOTE_INCREASE:{
                let drawCallback:()=>void;
                let releases:(()=>void)[] = [];
                const data = (event.data.cardData as COWGIRL_COYOTE_INCREASE).data;
                if(!data) break;
                const particleData = [
                    sideTernary(data.pos[1], game.fieldsA, game.fieldsB)[data.pos[0]-1]!.getCard()!.getStatModel(getVictim(data.stat))!.getWorldPosition(new Vector3()),
                    sideTernary(data.otherPos![1], game.fieldsA, game.fieldsB)[data.otherPos![0]-1]!.getCard()!.getStatModel(data.stat)!.getWorldPosition(new Vector3()),
                ] satisfies [Vector3, Vector3];
                game.setState(new VGuiState(game, [game.state, game.getGame().state], {
                    onEnd:(self)=>{
                        drawCallback();
                        for(const release of releases) release();

                        for(const field of [...game.fieldsA, ...game.fieldsB])
                            field.getCard()?.highlight(false, og029Highlight);
                    },
                    init: (self: VGuiState) => {
                        game.changeView(sideTernary(game.getMySide(), ViewType.FIELDS_A, ViewType.FIELDS_B));

                        const setTarget = (card:VisualCard)=>{
                            selectedCard.highlight(false, og029Highlight);
                            selectedCard=card;
                            selectedCard.highlight(true, og029Highlight);
                        }

                        let selectedCard:VisualCard;
                        for(const field of [...game.fieldsA, ...game.fieldsB]){
                            const card = field.getCard();
                            if(card !== undefined) {
                                releases.push(field.addClickListener(() => {
                                    setTarget(card);
                                }));

                                if(field.which === data.pos[0] && field.getSide() === data.pos[1]){
                                    selectedCard = card;
                                    selectedCard.highlight(true, og029Highlight);
                                }
                            }
                        }

                        let selectedStat=getVictim(data.stat);
                        drawCallback = registerDrawCallback(0, (p5, scale)=>{
                            self.statButtons(p5, scale,
                                (stat)=>selectedStat=stat,
                                (stat)=>selectedStat === stat,
                                (stat)=>"+2");
                            self.twoButtons(p5, scale, {
                                onClick:()=>{
                                    sendToServer(new CardAction({
                                        cardId:-1,
                                        actionName:CardActionOptions.COWGIRL_COYOTE_INCREASE,
                                        cardData:{data:{
                                            stat:selectedStat!,
                                            pos:[(sideTernary(selectedCard!.getSide(), game.fieldsA, game.fieldsB)
                                                .map(field=>field.getCard())
                                                .findIndex(card=>card?.logicalCard.id === selectedCard!.logicalCard.id) +1) as 1|2|3,
                                                selectedCard!.getSide()]
                                        }}
                                    })).onReply(eventReply().finally(()=>{
                                        self.end("finished");
                                    }));
                                },
                                text:"Increase",
                                disabled:selectedStat===undefined||selectedCard===undefined
                            }, {
                                onClick:()=> {
                                    sendToServer(new CardAction({
                                        cardId:-1,
                                        actionName:CardActionOptions.COWGIRL_COYOTE_INCREASE,
                                        cardData:{}
                                    })).onReply(eventReply().finally(()=>{
                                        self.end("finished");
                                    }));
                                },
                                text:"Pass",
                                disabled:false
                            });
                            self.infoText(p5, scale, "Select the card whose stat you want to increase and the stat you " +
                                "want to increase by 2");

                            particleArc(particleData[0], particleData[1],
                                statTernary(getVictim(data.stat), redStatColor, blueStatColor, yellowStatColor),
                                statTernary(data.stat, redStatColor, blueStatColor, yellowStatColor));
                        });
                    },
                }), game.getGame().state);
            }break;
            case CardActionOptions.BROY_WEASLA_INCREASE:{
                let drawCallback:()=>void;
                let releases:(()=>void)[] = [];
                const data = (event.data.cardData as BROY_WEASLA_INCREASE).data;
                if(!data) break;
                const particleData = [
                    sideTernary(data.pos[1], game.fieldsA, game.fieldsB)[data.pos[0]-1]!.getCard()!.getStatModel(getVictim(data.stat))!.getWorldPosition(new Vector3()),
                    sideTernary(data.otherPos![1], game.fieldsA, game.fieldsB)[data.otherPos![0]-1]!.getCard()!.getStatModel(data.stat)!.getWorldPosition(new Vector3()),
                ] satisfies [Vector3, Vector3];

                game.setState(new VGuiState(game, [game.state, game.getGame().state], {
                    onEnd:(self)=>{
                        drawCallback();
                        console.log("brooo")
                        for(const release of releases) release();

                        for(const field of [...game.fieldsA, ...game.fieldsB])
                            field.getCard()?.highlight(false, og029Highlight);
                    },
                    init: (self: VGuiState) => {
                        game.changeView(sideTernary(game.getMySide(), ViewType.FIELDS_A, ViewType.FIELDS_B));

                        const setTarget = (card:VisualCard)=>{
                            selectedCard.highlight(false, og029Highlight);
                            selectedCard=card;
                            selectedCard.highlight(true, og029Highlight);
                        }

                        let selectedCard:VisualCard;
                        for(const field of [...game.fieldsA, ...game.fieldsB]){
                            const card = field.getCard();
                            if(card !== undefined) {
                                releases.push(field.addClickListener(() => {
                                    setTarget(card);
                                }));

                                if(field.which === data.pos[0] && field.getSide() === data.pos[1]){
                                    selectedCard = card;
                                    selectedCard.highlight(true, og029Highlight);
                                }
                            }
                        }

                        let selectedStat=data.stat;
                        drawCallback = registerDrawCallback(0, (p5, scale)=>{
                            self.statButtons(p5, scale,
                                (stat)=>selectedStat=stat,
                                (stat)=>selectedStat === stat,
                                (stat)=>"+2");
                            self.twoButtons(p5, scale, {
                                onClick:()=>{
                                    sendToServer(new CardAction({
                                        cardId:-1,
                                        actionName:CardActionOptions.BROY_WEASLA_INCREASE,
                                        cardData:{data:{
                                            stat:selectedStat!,
                                            pos:[(sideTernary(selectedCard!.getSide(), game.fieldsA, game.fieldsB)
                                                .map(field=>field.getCard())
                                                .findIndex(card=>card?.logicalCard.id === selectedCard!.logicalCard.id) +1) as 1|2|3,
                                                selectedCard!.getSide()]
                                        }}
                                    })).onReply(eventReply().finally(()=>{
                                        self.end("finished");
                                    }));
                                },
                                text:"Increase",
                                disabled:selectedStat===undefined||selectedCard===undefined
                            }, {
                                onClick:()=> {
                                    sendToServer(new CardAction({
                                        cardId:-1,
                                        actionName:CardActionOptions.BROY_WEASLA_INCREASE,
                                        cardData:{}
                                    })).onReply(eventReply().finally(()=>{
                                        self.end("finished");
                                    }));
                                },
                                text:"Pass",
                                disabled:false
                            });
                            self.infoText(p5, scale, "Select the card whose stat you want to increase and the stat you " +
                                "want to increase by 2");

                            particleArc(particleData[0], particleData[1],
                                statTernary(getVictim(data.stat), redStatColor, blueStatColor, yellowStatColor),
                                statTernary(data.stat, redStatColor, blueStatColor, yellowStatColor));
                        });
                    },
                }), game.getGame().state);
            }break;
            case CardActionOptions.NOBLE_RETARGET:{
                let release:()=>void;
                const data = (event.data.cardData as NOBLE_RETARGET).data!;
                const scared = sideTernary(data.scared[1], game.fieldsA, game.fieldsB)[data.scared[0]-1]?.getCard();
                const scarer = sideTernary(data.scarer![1], game.fieldsA, game.fieldsB)[data.scarer![0]-1]?.getCard();
                const noble = sideTernary(game.getMySide(), game.fieldsA, game.fieldsB).find(f=>f.getCard()?.logicalCard.cardData.name === "og-020")
                    ?.getCard();
                const particleData = [
                    (data.stat === "card" ? scared?.model.getWorldPosition(new Vector3()) :
                        scared?.getStatModel(getVictim(data.stat))!.getWorldPosition(new Vector3())) ?? new Vector3(),
                    (data.stat === "card" ? scarer?.model.getWorldPosition(new Vector3()) :
                        scarer?.getStatModel(data.stat)!.getWorldPosition(new Vector3())) ?? new Vector3(),
                    (data.stat === "card" ? noble?.model.getWorldPosition(new Vector3()) :
                        noble?.getStatModel(getVictim(data.stat))!.getWorldPosition(new Vector3())) ?? new Vector3()
                ] satisfies [Vector3, Vector3, Vector3];

                game.setState(new VGuiState(game, [game.state,game.getGame().state], {
                    onEnd:(self,type)=>{
                        release();
                        sendToServer(new CardAction({
                            cardId: -1,
                            actionName: CardActionOptions.NOBLE_RETARGET,
                            cardData: {redirect:type === "finished"}
                        }));
                    },
                    init:(self)=>{
                        game.changeView(sideTernary(game.getMySide(), ViewType.FIELDS_A, ViewType.FIELDS_B));
                        release=registerDrawCallback(0,(p5,scale)=>{
                            self.twoButtons(p5,scale,{
                                text:"Retarget",
                                onClick:()=>self.end("finished")
                            },{
                                text:"Pass",
                                onClick:()=>self.end("canceled")
                            });
                            self.infoText(p5,scale,"Chose whether to redirect the scare to Noble Rat or leave it as-is");

                            particleArc(particleData[1], particleData[0],
                                data.stat === "card" ? whiteColor : statTernary(data.stat, redStatColor, blueStatColor, yellowStatColor),
                                data.stat === "card" ? whiteColor : statTernary(getVictim(data.stat), redStatColor, blueStatColor, yellowStatColor));
                            particleArc(particleData[1], particleData[2],
                                data.stat === "card" ? whiteColor : statTernary(data.stat, redStatColor, blueStatColor, yellowStatColor),
                                data.stat === "card" ? whiteColor : statTernary(getVictim(data.stat), redStatColor, blueStatColor, yellowStatColor));
                        });
                    }
                }), game.getGame().state);
            }break;
        }
    }else if(event instanceof DiscardAction){
        sideTernary(event.data.side!, game.runawayA, game.runawayB).addCard(game.elements.find(card=>
            VisualCard.getExactVisualCard(card)?.logicalCard.id === event.data.id) as VisualCard);
    }
}

const og029Highlight = newHighlightLock();