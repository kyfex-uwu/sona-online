import {Event, type SerializableType,} from "./Events.js";
import type Game from "../Game.js";

export const network:{
    sendToServer:(event:Event<any>)=>void,
    sendToClients:(event:Event<any>)=>void,
    replyToClient:(replyTo:Event<any>, replyWith:Event<any>)=>void,
    receiveFromClient:(event:{id:number,type:string,data:SerializableType}, client:{send:(v:string)=>any})=>void,
    receiveFromServer:(event:{id:number,type:string,data:SerializableType})=>void,

    findEmptyGame:()=>Game|undefined,
} = {
    sendToServer:()=>{},
    sendToClients:()=>{},
    replyToClient:()=>{},
    receiveFromClient:()=>{},
    receiveFromServer:()=>{},
    findEmptyGame:()=>undefined,
}

//top 10 most useless functions
export function sendEvent(event:Event<any>, actingAsServer:boolean){
    console.log("sending event: "+event.serialize())
    if(actingAsServer){
        network.sendToClients(event);
    }else{
        network.sendToServer(event);
    }
}
