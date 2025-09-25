import {eventReplyIds, network, Replyable} from "./Server.js";
import * as Events from "./Events.js";
import {
    ClarifyCardEvent,
    DetermineStarterEvent,
    DrawAction,
    Event,
    GameStartEvent,
    PassAction,
    PlaceAction,
    RequestSyncEvent,
    ScareAction,
    SyncEvent
} from "./Events.js";
import {game} from "../index.js";
import Card from "../Card.js";
import VisualCard from "../client/VisualCard.js";
import cards from "../Cards.js";
import {Euler, Quaternion, Vector3} from "three";
import {ViewType} from "../client/VisualGame.js";
import {other, Side} from "../GameElement.js";
import {wait} from "../client/clientConsts.js";
import type FieldMagnet from "../client/magnets/FieldMagnet.js";
import {VChoosingStartState, VTurnState} from "../client/VisualGameStates.js";
import {registerDrawCallback} from "../client/ui.js";
import {TurnState} from "../GameStates.js";
import {sideTernary} from "../consts.js";

const log = (data: any) => {
    //@ts-ignore
    if(window.showNetworkLogs)
        console.log(...data);
}

export function frontendInit(){
    network.clientGame=game.getGame();
    log("network initialized :D")
}

const websocket = new WebSocket("ws://"+window.location.host);
const websocketReady = new Promise(r=>websocket.addEventListener("open",r));
websocketReady.then(() => {
    websocket.onmessage = (message:MessageEvent<any>) => {
        const parsed = JSON.parse(message.data.toString());
        if(parsed.error !== undefined) log("Server error: "+parsed.error)
        else network.receiveFromServer(parsed);
    }
})

network.sendToServer = (event) => {
    websocketReady.then(()=>{
        websocket.send(event.serialize());
        log("sent "+event.serialize())
    });
    return new Replyable(event);
}
network.receiveFromServer = async (packed) => {
    //todo: this smells like vulnerability
    // @ts-ignore
    const event = new Events[packed.type](packed.data, game.getGame(), null, packed.id) as Event<any>;
    log("<- "+packed.type+"\n"+event.serialize());

    if(event.game !== undefined && (eventReplyIds[event.game.gameID]||{})[event.id] !== undefined){
        ((eventReplyIds[event.game.gameID]||{})[event.id]?._callback||(()=>{}))(event);
        return;
    }

    if(event instanceof GameStartEvent){
        game.getGame().setDeck(Side.A, event.data.deck);
        game.getGame().setDeck(Side.B, event.data.otherDeck.map(id=>{return{type:"unknown",id:id}}));
        game.getGame().setMySide(event.data.which);
        game.changeView(sideTernary(event.data.which, ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));
        if(game.getMySide() === Side.A){
            game.handB.rotation.slerp(new Quaternion().setFromEuler(new Euler(-1.7,Math.PI,0)),1);
            game.handB.position.add(new Vector3(0,100,0));
        }else{
            game.handA.rotation.slerp(new Quaternion().setFromEuler(new Euler(1.7,0, 0)),1);
            game.handA.position.add(new Vector3(0,100,0));
        }

        const myDeck = sideTernary(game.getMySide(), game.deckA, game.deckB);
        const theirDeck = sideTernary(other(game.getMySide()), game.deckA, game.deckB);
        const rotation = new Quaternion().setFromEuler(new Euler(Math.PI/2,0,0));
        for(const card of event.data.deck){
            const visualCard = game.addElement(new VisualCard(game, new Card(cards[card.type]!, game.getMySide(), card.id),
                new Vector3(), rotation));
            myDeck.addCard(visualCard);
        }
        for(const cardId of event.data.otherDeck){
            const visualCard = game.addElement(new VisualCard(game, new Card(cards.unknown!, other(game.getMySide()), cardId),
                new Vector3(), rotation));
            theirDeck.addCard(visualCard);
        }

        await wait(500);
    }else if (event instanceof ClarifyCardEvent){
        const oldVCard = game.elements.find(e=>e instanceof VisualCard && e.logicalCard.id === event.data.id) as VisualCard;
        if(oldVCard !== undefined){
            const newCard = event.data.cardDataName !== undefined ?
                new Card(cards[event.data.cardDataName!]!, oldVCard.logicalCard.side, oldVCard.logicalCard.id) :
                oldVCard.logicalCard;
            const oldCard = oldVCard.logicalCard;
            if(!oldCard.getFaceUp()) newCard.flipFacedown();

            if(event.data.cardDataName !== undefined){
                game.getGame().cards.delete(oldVCard.logicalCard);
                oldVCard.repopulate(newCard);
            }

            if(event.data.faceUp !== undefined && event.data.faceUp !== oldCard.getFaceUp())
                oldVCard[event.data.faceUp ? "flipFaceup" : "flipFacedown"]();

            game.getGame().cards.add(newCard);
        }
    }else if(event instanceof DetermineStarterEvent){
        if(game.state instanceof VChoosingStartState){
            const finish = ()=>{
                game.cursorActive=true;
                game.setState(new VTurnState(event.data.starter, game),
                    new TurnState(game.getGame(), event.data.starter, false));

                for(const field of game.fieldsA)
                    field.getCard()?.flipFaceup();
                for(const field of game.fieldsB)
                    field.getCard()?.flipFaceup();
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
            element instanceof VisualCard && element.logicalCard.id === event.data.cardId) as VisualCard;
        card.getHolder()?.removeCard(card);
        card.removeFromHolder();
        (sideTernary(event.data.side, game.fieldsA, game.fieldsB)[event.data.position-1] as FieldMagnet)
            .addCard(card);
        if(event.data.faceUp) card.flipFaceup();
        else card.flipFacedown();
        if(game.state instanceof VTurnState){
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
            const scared = sideTernary(event.data.scaredSide, game.fieldsA, game.fieldsB)[event.data.scaredPos-1]!.getCard();
            if (scared !== undefined) sideTernary(scared.getSide(), game.runawayA, game.runawayB).addCard(scared);
        }
        if(game.state instanceof VTurnState){
            game.state.decrementTurn();
        }
    }

    else if(event instanceof SyncEvent){
        log("fields A: "+event.data.fieldsA.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("deck A: "+event.data.deckA.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("runaway A: "+event.data.runawayA.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("hand A: "+event.data.handA.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("fields B: "+event.data.fieldsB.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("deck B: "+event.data.deckB.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("runaway B: "+event.data.runawayB.map(data => data?.cardData + "-"+data?.id).join(", "));
        log("hand B: "+event.data.handB.map(data => data?.cardData + "-"+data?.id).join(", "));
    }
}

//@ts-ignore
window.requestSync = ()=> game.sendEvent(new RequestSyncEvent({}));
