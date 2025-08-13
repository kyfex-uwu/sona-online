import {network} from "./Server.js";
import * as Events from "./Events.js"
import {Event, FindGameEvent, GameStartEvent, PlaceAction} from "./Events.js"
import Game from "../Game.js";
import {v4 as uuid} from "uuid"
import {Side} from "../GameElement.js";

const usersFromGameIDs:{[k:string]:Array<{send:(v:string)=>void}>}={};
const gamesFromUser:Map<any, Game> = new Map();
const unfilledGames:Array<(v:FindGameEvent)=>void> = [];

export function backendInit(){
    console.log("Backend initialized");
}

network.sendToClients = async (event) => {
    for(const user of (usersFromGameIDs[event.game!.gameID]||[])){
        user.send(event.serialize());
    }
}
network.receiveFromClient= (packed, client) => {
    //todo: this smells like vulnerability
    // @ts-ignore
    const event = new Events[packed.type](packed.data, gamesFromUser.get(client), client, packed.id) as Event<any>;
    console.log("received "+event.serialize())

    if(event instanceof FindGameEvent){
        if(unfilledGames.length>0){
            const gamePromise = unfilledGames.shift()!;
            gamePromise(event);
        }else{
            let resolve:(v:FindGameEvent)=>void;
            const waiter = new Promise<FindGameEvent>(r=>resolve=r);
            waiter.then((other) => {
                let id=0;
                const yourDeck = event.data.deck.map(name=>{return{type:name,id:id++}});
                const theirDeck = other.data.deck.map(name=>{return{type:name,id:id++}});
                const game = new Game(yourDeck, theirDeck, uuid());
                usersFromGameIDs[game.gameID] = [
                    event.sender!,
                    other.sender!
                ];
                gamesFromUser.set(event.sender!, game);
                gamesFromUser.set(other.sender!, game);
                network.replyToClient(event, new GameStartEvent({
                    deck:yourDeck,
                    which:Side.A,
                }, game));
                network.replyToClient(other, new GameStartEvent({
                    deck:theirDeck,
                    which:Side.B,
                }, game));
            })
            unfilledGames.push(resolve!);
        }
    }else if(event instanceof PlaceAction){
        if(event.game!==undefined){
            const card = event.game.cards.find(card=>card.id === event.data.cardId)!;
            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                user.send(new PlaceAction({
                    ...event.data,
                    cardDataName:card.cardData.name
                }).serialize());
            }
        }
    }
}
network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith.serialize());
}
