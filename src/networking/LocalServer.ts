import {network} from "./Server.js";
import * as Events from "./Events.js";
import {Event, GameStartEvent} from "./Events.js";
import {game} from "../index.js";
import Game from "../Game.js";
import Card from "../Card.js";
import VisualCard from "../client/VisualCard.js";
import cards from "../Cards.js";
import {Euler, Quaternion, Vector3} from "three";
import {ElementType, ViewType} from "../client/VisualGame.js";
import {other, Side} from "../GameElement.js";
import type DeckMagnet from "../client/magnets/DeckMagnet.js";
import {youThemTern} from "../consts.js";

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
}
network.receiveFromServer = (packed) => {
    //todo: this smells like vulnerability
    // @ts-ignore
    const event = new Events[packed.type](packed.data, game.getGame(), null, packed.id) as Event<any>;

    if(event instanceof GameStartEvent){
        game.setGame(new Game(event.data.deck, new Array<string>(20).fill("unknown"), Game.localID, event.data.which));
        game.changeView(youThemTern(event.data.which, ViewType.WHOLE_BOARD_YOU, ViewType.WHOLE_BOARD_THEM));
        const myDeck = game.getMy(ElementType.DECK) as DeckMagnet;
        const theirDeck = game.getTheir(ElementType.DECK) as DeckMagnet;
        const rotation = new Quaternion().setFromEuler(new Euler(Math.PI/2,0,0));
        for(const card of event.data.deck){
            const visualCard = game.addElement(new VisualCard(new Card(cards[card]!, game.getGame().side, 0),
                new Vector3(), rotation));
            myDeck.addCard(game, visualCard);
        }
        for(let i=0;i<20;i++){
            const visualCard = game.addElement(new VisualCard(new Card(cards.unknown!, other(game.getGame().side), 0),
                new Vector3(), rotation));
            theirDeck.addCard(game, visualCard);
        }
        if(game.getGame().side == Side.YOU){
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

        setTimeout(()=>{
            myDeck.drawCard(game);
            myDeck.drawCard(game);
            myDeck.drawCard(game);
            theirDeck.drawCard(game);
            theirDeck.drawCard(game);
            theirDeck.drawCard(game);
        }, 500);
    }
}
