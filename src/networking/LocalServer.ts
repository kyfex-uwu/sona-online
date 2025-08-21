import {network} from "./Server.js";
import * as Events from "./Events.js";
import {ClarifyCardEvent, DrawAction, Event, GameStartEvent, PlaceAction} from "./Events.js";
import {game} from "../index.js";
import Game from "../Game.js";
import Card from "../Card.js";
import VisualCard from "../client/VisualCard.js";
import cards from "../Cards.js";
import {Euler, Quaternion, Vector3} from "three";
import {ElementType, getField, ViewType} from "../client/VisualGame.js";
import {Side} from "../GameElement.js";
import type DeckMagnet from "../client/magnets/DeckMagnet.js";
import {sideTernary} from "../consts.js";
import {wait} from "../client/clientConsts.js";
import type HandFan from "../client/fans/HandFan.js";
import type FieldMagnet from "../client/magnets/FieldMagnet.js";

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
    console.log("received "+event.serialize())

    if(event instanceof GameStartEvent){
        game.setGame(new Game(event.data.deck, event.data.otherDeck.map(id=>{return{type:"unknown",id:id}}),
            Game.localID, event.data.which));
        game.changeView(sideTernary(event.data.which, ViewType.WHOLE_BOARD_YOU, ViewType.WHOLE_BOARD_THEM));
        const myDeck = game.getMy(ElementType.DECK) as DeckMagnet;
        const theirDeck = game.getTheir(ElementType.DECK) as DeckMagnet;
        const rotation = new Quaternion().setFromEuler(new Euler(Math.PI/2,0,0));
        for(const card of event.data.deck){
            const visualCard = game.addElement(new VisualCard(new Card(cards[card.type]!, game.getGame().side, card.id),
                new Vector3(), rotation));
            myDeck.addCard(game, visualCard);
        }
        for(const cardId of event.data.otherDeck){
            const visualCard = game.addElement(new VisualCard(new Card(cards.unknown!, game.getGame().side, cardId),
                new Vector3(), rotation));
            theirDeck.addCard(game, visualCard);
        }
        if(game.getGame().side == Side.A){
            game.theirHand.enabled=false;
            game.theirDeck.enabled=false;
            game.theirRunaway.enabled=false;
            for(const field of game.theirFields) field.enabled=false;
        }else{
            game.yourHand.enabled=false;
            game.yourRunaway.enabled=false;
            game.yourDeck.enabled=false;
            for(const field of game.yourFields) field.enabled=false;
        }

        await wait(500);

        myDeck.drawCard(game);
        myDeck.drawCard(game);
        myDeck.drawCard(game);
        theirDeck.drawCard(game);
        theirDeck.drawCard(game);
        theirDeck.drawCard(game);

        for(const card of (game.getMy(ElementType.HAND) as HandFan).cards){
            if(card.card.cardData.level !== 1) card.enabled = false;
        }
    }else if (event instanceof ClarifyCardEvent){
        const oldVCard = game.elements.find(e=>e instanceof VisualCard && e.card.id === event.data.id) as VisualCard;
        if(oldVCard !== undefined){
            const newCard = new Card(cards[event.data.cardDataName!]!, oldVCard.card.side, oldVCard.card.id);
            game.getGame().cards.push(newCard);
            game.getGame().cards.splice(game.getGame().cards.indexOf(oldVCard.card),1);
            oldVCard.repopulate(newCard);
        }
    }else if(event instanceof PlaceAction){
        const card =  game.elements.find(element =>
            element instanceof VisualCard && element.card.id === event.data.cardId) as VisualCard;
        (game.get(event.data.side, getField(event.data.position as 1|2|3)) as FieldMagnet)
            .addCard(game,card);
    }else if(event instanceof DrawAction){
        //todo
    }
}
