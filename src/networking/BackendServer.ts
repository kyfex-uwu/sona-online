import {eventReplyIds, network, Replyable} from "./Server.js";
import {
    AcceptEvent,
    Event,
    FindGameEvent, GameEvent,
    InternalStartGameEvent,
    InvalidEvent,
    RejectEvent,
    SerializableClasses,
    type SerializableType,
} from "./Events.js";
import Game from "../Game.js";
import {v4 as uuid} from "uuid"
import {shuffled} from "../consts.js";
import cards from "../Cards.js";
import {loadBackendWrappers} from "./BackendCardData.js";
import {parseEvent as gameParseEvent} from "./BackendGameServer.js";

export type Client ={send:(v:Event<any>)=>void};
const unfilledGames:Array<(v:FindGameEvent)=>void> = [];

export function backendInit(){
    loadBackendWrappers();
    console.log("Backend initialized");
}

//--

export const processedEventMarker = {dontUseThisRawCallRejectOrAccept:3 as 3};
export type processedEvent = {dontUseThisRawCallRejectOrAccept:3};
export function rejectEvent(event:Event<any>, reason:string){
    network.replyToClient(event, new RejectEvent({}, undefined, event.id));
    console.log(`# rejected ${event.id}(${typeof event}): ${reason}`);
    return processedEventMarker;
}
export function acceptEvent(event:Event<any>){
    network.replyToClient(event, new AcceptEvent({}, undefined, event.id));
    return processedEventMarker;
}

export function parseEvent(event:Event<any>):processedEvent{
    //todo: verify things are in array bounds!!!!

    if(event instanceof FindGameEvent){
        if(!event.data.deck.some(card => cards[card]?.level === 1))
            return rejectEvent(event, "no level one card in deck");
        if(event.data.deck.some(card => cards[card] === undefined))
            return rejectEvent(event, "invalid card found");
        if(event.data.deck.length!==20)
            return rejectEvent(event, "deck must be 20 cards");

        const cardDuplChecker:{[key:string]:true} = {};
        for(const card of event.data.deck) {
            if (cardDuplChecker[card] !== undefined) return rejectEvent(event, "duplicate card found");
            cardDuplChecker[card] = true;
        }

        if(unfilledGames.length>0){
            const gamePromise = unfilledGames.shift()!;
            gamePromise(event);
            return acceptEvent(event);
        }else{
            let resolve:(v:FindGameEvent)=>void;
            const waiter = new Promise<FindGameEvent>(r=>resolve=r);
            waiter.then((other) => {
                let id=0;

                let firstA = event.data.deck[0];
                let firstB = other.data.deck[0];
                const deckA = shuffled(event.data.deck).map(name=>{return{type:name,id:id++}});
                const deckB = shuffled(other.data.deck).map(name=>{return{type:name,id:id++}});
                deckA.push(...deckA.splice(deckA.findIndex(v=>v.type === firstA),1));
                deckB.push(...deckB.splice(deckB.findIndex(v=>v.type === firstB),1));

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

                gameParseEvent(new InternalStartGameEvent(new Game(deckA, deckB, uuid()), event.sender!, other.sender!));
            })
            unfilledGames.push(resolve!);
            return acceptEvent(event);
        }
    }else if(event instanceof GameEvent){
        return gameParseEvent(event);
    }

    else return rejectEvent(event, "not a recognized event");
}

export async function receiveFromClient (packed:{
    type:string,
    data:SerializableType,
    id:string
}, client:Client) {
    //todo: this smells like vulnerability (but less now!)
    const event = new (SerializableClasses[packed.type] || InvalidEvent)(
        //@ts-ignore
        packed.data, client, packed.id) as Event<any>;
    if(true) console.log("received "+event.serialize());

    if(eventReplyIds[event.id] !== undefined){
        (eventReplyIds[event.id]?._callback||(()=>{}))(event);
        return;
    }

    //todo: verify shape of event
    parseEvent(event);
}

network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith);
    return new Replyable(replyWith);
}
