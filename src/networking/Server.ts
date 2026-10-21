import {AcceptEvent, Event, PerchanceEvent, RejectEvent, type SerializableEventData,} from "./Events.js";
import type Game from "../Game.js";

class FlagData{
    type:"number"|"boolean";
    val;

    constructor(type:"number"|"boolean", defaultVal:any) {
        this.type=type;
        this.val=defaultVal;
    }

}
type flagName<T>={}
export const flagNames={
    CHILI_MAMA_ALL_CANINES:"CHILI_MAMA_ALL_CANINES" as flagName<boolean>
}
export const flags = {
    [flagNames.CHILI_MAMA_ALL_CANINES as string]:new FlagData("boolean", false),
};
export function getFlag<T>(name:flagName<T>){
    return flags[name as string]!.val as T;
}

export const eventReplyIds:{[k:string]:Replyable<any>} = {}
export class Replyable<T extends SerializableEventData>{
    public _callback?: (event: Event<any>) => void;
    private readonly source:Event<T>;
    constructor(source:Event<T>) {
        this.source=source;
    }
    onReply(callback:(event:Event<any>)=>void){
        if(this._callback !== undefined){
            console.trace("tried to 2 event reply callbacks");
            return;
        }

        eventReplyIds![this.source.id] = this;
        this._callback=callback;
        return this.source;
    }
}
export function acceptEvent(){
    const data:{success?: () => void, fail?: () => void, finally?: () => void} = {};
    const toReturn = (event:Event<any>) =>{
        if(event instanceof PerchanceEvent) return;

        if(event instanceof AcceptEvent && data.success) data.success();
        else if(event instanceof RejectEvent && data.fail) data.fail();
        if(data.finally) data?.finally();
    }
    toReturn.success = (callback:()=>void)=> {
        data.success = callback;
        return toReturn;
    };
    toReturn.fail = (callback:()=>void)=> {
        data.fail = callback;
        return toReturn;
    };
    toReturn.finally = (callback:()=>void)=> {
        data.finally = callback;
        return toReturn;
    };
    return toReturn;
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
    //Replies with an event to a single client
    replyToClient:<T extends SerializableEventData> (replyTo:Event<T>, replyWith:Event<any>)=>Replyable<T>,

    clientGame?:Game,
} = {
    sendToServer:(e)=>new Replyable(e),
    replyToClient:(e)=>new Replyable(e),
}
