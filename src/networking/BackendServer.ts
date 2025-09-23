import {network} from "./Server.js";
import * as Events from "./Events.js";
import {
    type Card as SerializableCard,
    cardsTransform,
    ClarifyCardEvent,
    DetermineStarterEvent,
    DrawAction,
    Event,
    FindGameEvent,
    GameStartEvent,
    GameStartEventWatcher, PassAction,
    PlaceAction,
    RequestSyncEvent, ScareAction,
    StartRequestEvent,
    SyncEvent
} from "./Events.js";
import Game from "../Game.js";
import {v4 as uuid} from "uuid"
import {Side} from "../GameElement.js";
import {shuffled, sideTernary} from "../consts.js";
import type Card from "../Card.js";
import cards from "../Cards.js";
import {TurnState} from "../GameStates.js";

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
        if(!event.data.deck.some(card => cards[card]?.level === 1)) {
            return;
        }

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
                let hasLevel1A=false;
                let hasLevel1B=false;
                for(let i=0;i<3;i++){
                    if(!hasLevel1A && deckA[deckA.length-1-i]?.type !== undefined && cards[deckA[deckA.length-1-i]?.type!]?.level === 1){
                        hasLevel1A=true;
                    }
                    if(!hasLevel1B && deckB[deckB.length-1-i]?.type !== undefined && cards[deckB[deckB.length-1-i]?.type!]?.level === 1){
                        hasLevel1B=true;
                    }
                }
                if(!hasLevel1A){
                    const toFront = shuffled(deckA.filter(card => cards[card.type]?.level === 1))[0]!;
                    deckA.splice(deckA.indexOf(toFront), 1);
                    deckA.splice(deckA.length-Math.floor(Math.random()*3), 0, toFront);
                }
                if(!hasLevel1B){
                    const toFront = shuffled(deckB.filter(card => cards[card.type]?.level === 1))[0]!;
                    deckB.splice(deckB.indexOf(toFront), 1);
                    deckB.splice(deckB.length-Math.floor(Math.random()*3), 0, toFront);
                }
                // console.log(deckA.map(card => cards[card.type]?.level))
                // console.log(deckB.map(card => cards[card.type]?.level))

                const game = new Game(deckA, deckB, uuid());

                usersFromGameIDs[game.gameID] = [
                    event.sender!,
                    other.sender!
                ];
                gamesFromUser.set(event.sender!, game);
                gamesFromUser.set(other.sender!, game);
                game.setPlayers(event.sender!, other.sender!);

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
                for(const user of (usersFromGameIDs[game.gameID]||[])){
                    if(user !== event.sender && user !== other.sender){
                        user.send(new GameStartEventWatcher({
                            deck:deckB.map(card => card.id),
                            otherDeck:deckA.map(card => card.id),
                            which:Side.B,
                        }, game));
                    }
                    for(let i=0;i<3;i++){
                        user.send(new DrawAction({side:Side.A}));
                        user.send(new DrawAction({side:Side.B}));
                    }
                }

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

                for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                    user.send(new DetermineStarterEvent({
                        starter:startingSide,
                        flippedCoin:flippedCoin,
                    }));
                    for(const card of event.game.fieldsA)
                        if(card !== undefined)
                            user.send(new ClarifyCardEvent({
                                id: card.id,
                                cardDataName:card.cardData.name,
                            }));
                    for(const card of event.game.fieldsB)
                        if(card !== undefined)
                            user.send(new ClarifyCardEvent({
                                id: card.id,
                                cardDataName:card.cardData.name,
                            }));
                    event.game.state = new TurnState(event.game, startingSide);
                }
            }
        }
    }else if(event instanceof PlaceAction){
        if(event.game!==undefined){
            const card = event.game.cards.values().find(card=>card.id === event.data.cardId)!;
            sideTernary(event.data.side, event.game.fieldsA, event.game.fieldsB)[event.data.position-1] =
                event.game.cards.values().find(card => card.id === event.data.cardId);

            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                if(event.data.faceUp)
                    user.send(new ClarifyCardEvent({
                        id: event.data.cardId,
                        cardDataName: card.cardData.name,
                        faceUp: event.data.faceUp,
                    }));
                user.send(new PlaceAction({
                    ...event.data,
                }));
            }
        }
    }else if(event instanceof DrawAction){
        if(event.game !== undefined){
            let side:Side|undefined=undefined;
            if(event.sender === event.game.player(Side.A)){
                side = Side.A;
            }else if(event.sender === event.game.player(Side.B)){
                side = Side.B;
            }
            if(side !== undefined){
                const card = sideTernary(side, event.game.deckA, event.game.deckB).pop();
                if(card !== undefined){
                    sideTernary(side, event.game.handA, event.game.handB).push(card);
                    for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                        if(user === event.sender) continue;
                        user.send(new DrawAction({side:side}, undefined, undefined, event.id));
                    }
                }
            }
        }
    }else if (event instanceof PassAction){
        if(event.game !== undefined){
            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                if(user === event.sender) continue;
                user.send(new PassAction({}));
            }
        }
    }else if (event instanceof ScareAction){
        if(event.game !== undefined){
            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                user.send(new ScareAction({
                    scaredId:event.data.scaredId,
                    scarerId:event.data.scarerId,
                    attackingWith:event.data.attackingWith,
                }));
            }
        }
    }

    else if(event instanceof RequestSyncEvent && true){
        if(event.game!==undefined) {
            event.sender?.send(new SyncEvent({
                fieldsA: cardsTransform(event.game.fieldsA as Array<Card>) as [SerializableCard|undefined, SerializableCard|undefined, SerializableCard|undefined],
                fieldsB: cardsTransform(event.game.fieldsB as Array<Card>) as [SerializableCard|undefined, SerializableCard|undefined, SerializableCard|undefined],
                deckA: cardsTransform(event.game.deckA),
                deckB: cardsTransform(event.game.deckB),
                handA: cardsTransform(event.game.handA),
                handB: cardsTransform(event.game.handB),
                runawayA: cardsTransform(event.game.runawayA),
                runawayB: cardsTransform(event.game.runawayB),
            }));
        }
    }
}
network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith);
}
