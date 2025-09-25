import {AcceptEvent, Event, RejectEvent, type SerializableEventData, type SerializableType,} from "./Events.js";
import type Game from "../Game.js";
import type {Client} from "./BackendServer.js";

export const eventReplyIds:{[k:string]:{[k:string]:Replyable<any>}} = {}
export class Replyable<T extends SerializableEventData>{
    public _callback?: (event: Event<any>) => void;
    private readonly source:Event<T>;
    constructor(source:Event<T>) {
        this.source=source;
    }
    onReply(callback:(event:Event<any>)=>void){
        if(this.source.game === undefined){
            console.trace("tried to add a reply callback to a message not in a game");
            return;
        }
        if(this._callback !== undefined){
            console.trace("tried to 2 event reply callbacks");
            return;
        }

        if(eventReplyIds[this.source.game.gameID] === undefined)
            eventReplyIds[this.source.game.gameID] = {};
        eventReplyIds[this.source.game.gameID]![this.source.id] = this;
        this._callback=callback;
        return this.source;
    }
}
export function successOrFail(success: () => void, fail?: () => void, finaly?: () => void){
    return (event:Event<any>) =>{
        if(event instanceof AcceptEvent) success();
        else if(fail !== undefined && event instanceof RejectEvent) fail();
        if(finaly !== undefined) finaly();
    }
}
export function cancelCallback(callback: () => void, finaly?:()=>void){
    return (event:Event<any>) =>{
        if(event instanceof RejectEvent) callback();
        if(finaly !== undefined) finaly();
    }
}

export const network:{
    //Sends a message to the server
    sendToServer:<T extends SerializableEventData> (event:Event<T>)=>Replyable<T>,
    //Sends a message to all clients in the event's game
    sendToClients:<T extends SerializableEventData> (event:Event<T>)=>void,
    //Replies with an event to a single client
    replyToClient:<T extends SerializableEventData> (replyTo:Event<T>, replyWith:Event<any>)=>Replyable<T>,
    //Processes an event from the client
    receiveFromClient:(event:{id:number,type:string,data:SerializableType}, client:Client)=>void,
    //Processes an event from the server
    receiveFromServer:(event:{id:number,type:string,data:SerializableType})=>void,

    clientGame?:Game,
} = {
    sendToServer:(e)=>new Replyable(e),
    sendToClients:(e)=>new Replyable(e),
    replyToClient:(e)=>new Replyable(e),
    receiveFromClient:()=>{},
    receiveFromServer:()=>{},
}
