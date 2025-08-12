import {network} from "./Server.js";
import * as Events from "./Events.js"
import {Event, FindGameEvent, GameStartEvent} from "./Events.js"
import Game from "../Game.js";
import {v4 as uuid} from "uuid"
import {Side} from "../GameElement.js";

const usersFromGameIDs:{[k:string]:Array<{send:(v:string)=>void}>}={};
const unfilledGames:Array<(v:FindGameEvent)=>void> = [];
const games:{[k:string]:Game}={};

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
    const event = new Events[packed.type](packed.data, null, client, packed.id) as Event<any>;

    if(event instanceof FindGameEvent){
        if(unfilledGames.length>0){
            const gamePromise = unfilledGames.shift()!;
            gamePromise(event);
        }else{
            let resolve:(v:FindGameEvent)=>void;
            const waiter = new Promise<FindGameEvent>(r=>resolve=r);
            waiter.then((other) => {
                const game = new Game(event.data.deck, other.data.deck, uuid());
                usersFromGameIDs[game.gameID] = [
                    event.sender!,
                    other.sender!
                ];
                network.replyToClient(event, new GameStartEvent({
                    deck:event.data.deck,
                    which:Side.YOU,
                }, game));
                network.replyToClient(other, new GameStartEvent({
                    deck:other.data.deck,
                    which:Side.THEM,
                }, game));
            })
            unfilledGames.push(resolve!);
        }
    }
}
network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith.serialize());
}
