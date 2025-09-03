import {network} from "./Server.js";
import * as Events from "./Events.js"
import {
    ClarifyCardEvent,
    DetermineStarterEvent,
    Event,
    FindGameEvent,
    GameStartEvent,
    PlaceAction,
    StartRequestEvent
} from "./Events.js"
import Game from "../Game.js";
import {v4 as uuid} from "uuid"
import {Side} from "../GameElement.js";
import {shuffled} from "../consts.js";

export type Client ={send:(v:Event<any>)=>void};
const usersFromGameIDs:{[k:string]:Array<Client>}={};
const gamesFromUser:Map<any, Game> = new Map();
const unfilledGames:Array<(v:FindGameEvent)=>void> = [];

export function backendInit(){
    console.log("Backend initialized");
}

network.sendToClients = async (event) => {
    for(const user of (usersFromGameIDs[event.game!.gameID]||[])){
        user.send(event);
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
                const deckA = shuffled(event.data.deck).map(name=>{return{type:name,id:id++}});
                const deckB = shuffled(other.data.deck).map(name=>{return{type:name,id:id++}});
                const game = new Game(deckA, deckB, uuid());
                usersFromGameIDs[game.gameID] = [
                    event.sender!,
                    other.sender!
                ];
                gamesFromUser.set(event.sender!, game);
                gamesFromUser.set(other.sender!, game);
                network.replyToClient(event, new GameStartEvent({
                    deck:deckA,
                    otherDeck: deckB.map(card => card.id),
                    which:Side.A,
                }, game));
                network.replyToClient(other, new GameStartEvent({
                    deck:deckB,
                    otherDeck:deckA.map(card => card.id),
                    which:Side.B,
                }, game));
                game.setPlayers(event.sender!, other.sender!);

                // for(const card of deckA){
                //     network.replyToClient(other, new ClarifyCardEvent({
                //         id:card.id,
                //         cardDataName:card.type
                //     }))
                // }
                // for(const card of deckB){
                //     network.replyToClient(event, new ClarifyCardEvent({
                //         id:card.id,
                //         cardDataName:card.type
                //     }))
                // }
            })
            unfilledGames.push(resolve!);
        }
    }else if(event instanceof StartRequestEvent){
        if(event.game!==undefined){
            event.game.miscData[(event.sender === event.game.player(Side.A))?
                "playerAStartRequest" :
                "playerBStartRequest"] = event.data.which;

            if(event.game.miscData.playerAStartRequest !== undefined &&
                event.game.miscData.playerBStartRequest !== undefined){
                let startingSide: Side;
                let flippedCoin: boolean;

                if(event.game.miscData.playerAStartRequest ===
                    event.game.miscData.playerBStartRequest){
                    flippedCoin=true;
                    startingSide = Math.random()<0.5 ? Side.A : Side.B;
                }else{
                    flippedCoin=false;
                    if(event.game.miscData.playerAStartRequest === "nopref"){
                        startingSide = event.game.miscData.playerBStartRequest === "first" ? Side.B : Side.A;
                    }else if(event.game.miscData.playerBStartRequest === "nopref"){
                        startingSide = event.game.miscData.playerAStartRequest === "first" ? Side.A : Side.B;
                    }else{
                        //first and second
                        startingSide = event.game.miscData.playerBStartRequest === "first" ? Side.B : Side.A;
                    }
                }

                const toSend = new DetermineStarterEvent({
                    starter:startingSide,
                    flippedCoin:flippedCoin,
                });
                for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                    user.send(toSend);
                }
            }
        }
    }else if(event instanceof PlaceAction){
        if(event.game!==undefined){
            const card = event.game.cards.find(card=>card.id === event.data.cardId)!;
            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                user.send(new ClarifyCardEvent({
                    id: event.data.cardId,
                    cardDataName:card.cardData.name
                }));
                user.send(new PlaceAction({
                    ...event.data,
                }));
            }

            event.game.stateTick();
        }
    }
}
network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith);
}
