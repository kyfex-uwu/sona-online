import {network} from "./Server.js";
import * as Events from "./Events.js";
import {
    ClarifyCardEvent,
    DetermineStarterEvent,
    DrawAction,
    Event,
    GameStartEvent, PassAction,
    PlaceAction,
    RequestSyncEvent
} from "./Events.js";
import {game} from "../index.js";
import Game from "../Game.js";
import Card from "../Card.js";
import VisualCard from "../client/VisualCard.js";
import cards from "../Cards.js";
import {Euler, Quaternion, Vector3} from "three";
import {getField, ViewType} from "../client/VisualGame.js";
import {Side} from "../GameElement.js";
import {cSideTernary} from "../client/clientConsts.js";
import {wait} from "../client/clientConsts.js";
import type FieldMagnet from "../client/magnets/FieldMagnet.js";
import {VChoosingStartState, VTurnState} from "../client/VisualGameStates.js";
import {registerDrawCallback} from "../client/ui.js";

export function frontendInit(){
    console.log("network initialized :D")
}

const websocket = new WebSocket("ws://"+window.location.host);
const websocketReady = new Promise(r=>websocket.addEventListener("open",r));
websocketReady.then(() => {
    websocket.onmessage = (message:MessageEvent<any>) => {
        const parsed = JSON.parse(message.data.toString());
        if(parsed.error !== undefined) console.log("Server error: "+parsed.error)
        else network.receiveFromServer(parsed);
    }
})

network.sendToServer = async (event) => {
    await websocketReady;
    websocket.send(event.serialize());
    console.log("sent "+event.serialize())
}
network.receiveFromServer = async (packed) => {
    //todo: this smells like vulnerability
    // @ts-ignore
    const event = new Events[packed.type](packed.data, game.getGame(), null, packed.id) as Event<any>;
    console.log("<- "+packed.type+"\n"+event.serialize())

    if(event instanceof GameStartEvent){
        game.setGame(new Game(event.data.deck, event.data.otherDeck.map(id=>{return{type:"unknown",id:id}}),
            Game.localID, event.data.which));
        game.changeView(cSideTernary(event.data.which, ViewType.WHOLE_BOARD_YOU, ViewType.WHOLE_BOARD_THEM));
        const myDeck = cSideTernary(game, game.deckA, game.deckB);
        const theirDeck = cSideTernary(game, game.deckB, game.deckA);
        const rotation = new Quaternion().setFromEuler(new Euler(Math.PI/2,0,0));
        for(const card of event.data.deck){
            const visualCard = game.addElement(new VisualCard(new Card(cards[card.type]!, game.getMySide(), card.id),
                new Vector3(), rotation));
            myDeck.addCard(game, visualCard);
        }
        for(const cardId of event.data.otherDeck){
            const visualCard = game.addElement(new VisualCard(new Card(cards.unknown!, game.getMySide(), cardId),
                new Vector3(), rotation));
            theirDeck.addCard(game, visualCard);
        }
        if(game.getMySide() == Side.B){
            game.handB.enabled=true;
            for(const field of game.fieldsB) field.enabled=true;
        }else{
            game.handA.enabled=true;
            for(const field of game.fieldsA) field.enabled=true;
        }

        await wait(500);

        for(const card of cSideTernary(game, game.handA, game.handB).cards){
            if(card.card.cardData.level !== 1) card.enabled = false;
        }
    }else if (event instanceof ClarifyCardEvent){
        const oldVCard = game.elements.find(e=>e instanceof VisualCard && e.card.id === event.data.id) as VisualCard;
        if(oldVCard !== undefined){
            const newCard = event.data.cardDataName !== undefined ?
                new Card(cards[event.data.cardDataName!]!, oldVCard.card.side, oldVCard.card.id) :
                oldVCard.card;
            const oldCard = oldVCard.card;
            if(!oldCard.getFaceUp()) newCard._flipFacedown();

            if(event.data.cardDataName !== undefined){
                game.getGame().cards.delete(oldVCard.card);
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
                game.state = new VTurnState(event.data.starter, game);

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
            element instanceof VisualCard && element.card.id === event.data.cardId) as VisualCard;
        card.getHolder()?.removeCard(game, card);
        card.removeFromHolder();
        (game.get(event.data.side, getField(event.data.position as 1|2|3)) as FieldMagnet)
            .addCard(game,card);
        card[event.data.faceUp?"flipFaceup":"flipFacedown"]();
        if(game.state instanceof VTurnState){
            game.state.decrementTurn();
        }
    }else if(event instanceof DrawAction){
        console.log(cSideTernary(event.data.side ?? game.getMySide(), game.deckA, game.deckB))
        cSideTernary(event.data.side ?? game.getMySide(), game.deckA, game.deckB).drawCard(game);

        if(game.state instanceof VTurnState){
            game.state.decrementTurn();
        }
    }else if(event instanceof PassAction){
        if(game.state instanceof VTurnState){
            game.state.decrementTurn();
        }
    }
}

//@ts-ignore
window.requestSync = ()=> game.sendEvent(new RequestSyncEvent({}));
