import {eventReplyIds, network, Replyable} from "./Server.js";
import {
    CardAction, ClarificationJustification,
    ClarifyCardEvent,
    DetermineStarterEvent,
    DrawAction,
    Event,
    GameStartEvent, InvalidEvent, MultiClarifyCardEvent,
    PassAction,
    PlaceAction,
    RequestSyncEvent,
    ScareAction, SerializableClasses, type SerializableType,
    StringReprSyncEvent,
    SyncEvent
} from "./Events.js";
import {game} from "../index.js";
import Card from "../Card.js";
import VisualCard from "../client/VisualCard.js";
import cards from "../Cards.js";
import {Euler, Quaternion, Vector3} from "three";
import {ViewType} from "../client/VisualGame.js";
import {other, Side} from "../GameElement.js";
import {sideTernary, wait} from "../consts.js";
import type FieldMagnet from "../client/magnets/FieldMagnet.js";
import {VChoosingStartState, VTurnState} from "../client/VisualGameStates.js";
import {registerDrawCallback} from "../client/ui.js";
import {BeforeGameState, TurnState} from "../GameStates.js";
import {loadFrontendWrappers} from "../client/VisualCardData.js";
import {
    type AMBER_PICK, AmberData,
    type BOTTOM_DRAW,
    type BROWNIE_DRAW,
    CardActionOptions,
    type CLOUD_CAT_PICK, type FURMAKER_PICK, type WORICK_RESCUE,
    type YASHI_REORDER
} from "./CardActionOption.js";
import {GameMiscDataStrings} from "../Game.js";

//@ts-ignore
window.showNetworkLogs=false;
const log = (...data: any) => {
    //@ts-ignore
    if(window.showNetworkLogs)
        if(typeof data === "string") console.log(data);
        else console.log(...data);
}

export function frontendInit(){
    network.clientGame=game.getGame();
    loadFrontendWrappers();
    log("network initialized :D")
}

const websocket = new WebSocket("ws://"+window.location.host);
const websocketReady = new Promise(r=>websocket.addEventListener("open",r));
websocketReady.then(() => {
    websocket.onmessage = (message:MessageEvent<any>) => {
        const parsed = JSON.parse(message.data.toString());
        if(parsed.error !== undefined) log("Server error: "+parsed.error)
        else receiveFromServer(parsed);
    }
})

function clarifyCard(id:number, cardDataName?:string, faceUp?:boolean){
    const visualCard = game.elements.find(e=>VisualCard.getExactVisualCard(e)?.logicalCard.id === id) as VisualCard;
    if(visualCard === undefined) return;
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

network.sendToServer = (event) => {
    websocketReady.then(()=>{
        websocket.send(event.serialize());
        if(!(event instanceof RequestSyncEvent))
            log("sent "+event.serialize())
    });
    return new Replyable(event);
}

const logColors:{[key:string]:string}={
    DrawAction:"#88f",
    PlaceAction:"#8f8",
    ScareAction:"#f88",
    CardAction:"#ff8",
    PassAction:"#a8f",

    AcceptEvent:"#0f0",
    RejectEvent:"#f00",

    GameStartEvent:"#8ff",
    DetermineStarterEvent:"#fb8",
    ClarifyCardEvent:"#8fc"
}

const waitingForClarify:{[k:number]:((event:ClarifyCardEvent|MultiClarifyCardEvent)=>void)[]} = {};
export function waitForClarify(justification:ClarificationJustification,
                               callback:(event:ClarifyCardEvent|MultiClarifyCardEvent)=>void){
    if(waitingForClarify[justification] === undefined)
        waitingForClarify[justification] = [];
    waitingForClarify[justification].push(callback);
}

async function receiveFromServer(packed:{
    type:string,
    data:SerializableType,
    id:string,
}) {
    //todo: this smells like vulnerability (but less!)
    const event = new (SerializableClasses[packed.type] || InvalidEvent)(
        //@ts-ignore
        packed.data,
        game.getGame(), null, packed.id) as Event<any>;
    if(packed.type !== "SyncEvent" && packed.type !== "StringReprSyncEvent")
        log("%c -> "+packed.type+"\n"+event.serialize(), `background:${(logColors[packed.type]||"#000")+"2"}; color:${logColors[packed.type]||"#fff"}`);

    if(event.game !== undefined && (eventReplyIds[event.game.gameID]||{})[event.id] !== undefined){
        ((eventReplyIds[event.game.gameID]||{})[event.id]?._callback||(()=>{}))(event);
        return;
    }

    if(event instanceof GameStartEvent){
        game.getGame().setMySide(event.data.which);
        game.changeView(sideTernary(event.data.which, ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));
        if(game.getMySide() === Side.A){
            game.handB.rotation.slerp(new Quaternion().setFromEuler(new Euler(-1.7,Math.PI,0)),1);
            game.handB.position.add(new Vector3(0,100,60));
        }else{
            game.handA.rotation.slerp(new Quaternion().setFromEuler(new Euler(1.7,0, 0)),1);
            game.handA.position.add(new Vector3(0,100,-60));
        }

        const myDeck = sideTernary(game.getMySide(), game.deckA, game.deckB);
        const theirDeck = sideTernary(other(game.getMySide()), game.deckA, game.deckB);
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
            const finish = ()=>{
                game.cursorActive=true;
                game.setState(new VTurnState(event.data.starter, game, false),
                    new TurnState(game.getGame(), event.data.starter, false));
                (game.state as VTurnState).canInit=true;//top 10 worst things

                for(const field of game.fieldsA) {
                    field.getCard()?.flipFaceup();
                    field.startGame();
                }
                for(const field of game.fieldsB) {
                    field.getCard()?.flipFaceup();
                    field.startGame();
                }
                if(game.state instanceof VTurnState) game.state.init();
            }
            if(event.data.flippedCoin){
                let timer=0;
                let removeCallback = registerDrawCallback(0,(p5, _scale) =>{
                    p5.background(30,30,30,150);

                    if(timer>60*3) {
                        removeCallback();
                        finish();
                    }

                    timer++;
                })
            }else{
                finish();
            }
        }
    }else if(event instanceof PlaceAction){
        const card =  game.elements.find(element =>
            VisualCard.getExactVisualCard(element)?.logicalCard.id === event.data.cardId) as VisualCard;
        card.getHolder()?.removeCard(card);
        card.removeFromHolder();
        (sideTernary(event.data.side, game.fieldsA, game.fieldsB)[event.data.position-1] as FieldMagnet)
            .addCard(card);
        if(event.data.faceUp) card.flipFaceup();
        else card.flipFacedown();
        if(game.state instanceof VTurnState && !(event.data.forFree ?? false)){
            game.state.decrementTurn();
        }
    }else if(event instanceof DrawAction){
        sideTernary(event.data.side ?? game.getMySide(), game.deckA, game.deckB).drawCard();

        if(game.state instanceof VTurnState && event.data.isAction !== false){
            game.state.decrementTurn();
        }
    }else if(event instanceof PassAction){
        if(game.state instanceof VTurnState){
            game.state.decrementTurn();
        }
    }else if(event instanceof ScareAction){
        if(event.data.failed !== true) {
            const scared = sideTernary(event.data.scaredPos[1], game.fieldsA, game.fieldsB)[event.data.scaredPos[0]-1]!.getCard();
            if (scared !== undefined) sideTernary(scared.getSide(), game.runawayA, game.runawayB).addCard(scared);
        }
        if(game.state instanceof VTurnState){
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
                }
            }break;
            case CardActionOptions.AMBER_PICK:{
                const data = (event as CardAction<AMBER_PICK>).data.cardData;

                const toReorder = sideTernary(data.side!, game.deckA, game.deckB).getCards();
                let [card1, card2] = [toReorder[toReorder.length-1], toReorder[toReorder.length-2]];
                if(data!.which === AmberData.KEEP_SECOND) [card1, card2] = [card2, card1];
                card1?.flipFaceup();
                card2?.flipFaceup();
                if(card1 !== undefined) sideTernary(data.side!, game.handA, game.handB).addCard(card1);
                if(card2 !== undefined) sideTernary(data.side!, game.runawayA, game.runawayB).addCard(card2);
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
                    game.getGame().state instanceof BeforeGameState ? "first" : (event as CardAction<CLOUD_CAT_PICK>).data.cardData;
            }break;
        }
    }

    else if(event instanceof SyncEvent){
        // log("fields A: "+event.data.fieldsA.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("deck A: "+event.data.deckA.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("runaway A: "+event.data.runawayA.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("hand A: "+event.data.handA.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("fields B: "+event.data.fieldsB.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("deck B: "+event.data.deckB.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("runaway B: "+event.data.runawayB.map(data => data?.cardData + "-"+data?.id).join(", "));
        // log("hand B: "+event.data.handB.map(data => data?.cardData + "-"+data?.id).join(", "));
    }else if(event instanceof StringReprSyncEvent){
        game.debugLast=event.data.str;
    }
}

//@ts-ignore
window.requestSync = ()=> game.sendEvent(new RequestSyncEvent({}));
