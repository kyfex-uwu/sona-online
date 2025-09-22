import {Event, type SerializableType,} from "./Events.js";
import type Game from "../Game.js";
import type {Client} from "./BackendServer.js";

export const network:{
    //Sends a message to the server
    sendToServer:(event:Event<any>)=>void,
    //Sends a message to all clients in the event's game
    sendToClients:(event:Event<any>)=>void,
    //Replies with an event to a single client
    replyToClient:(replyTo:Event<any>, replyWith:Event<any>)=>void,
    //Processes an event from the client
    receiveFromClient:(event:{id:number,type:string,data:SerializableType}, client:Client)=>void,
    //Processes an event from the server
    receiveFromServer:(event:{id:number,type:string,data:SerializableType})=>void,

    //unused
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
    //console.log("sending event: "+event.serialize())
    if(actingAsServer){
        network.sendToClients(event);
    }else{
        network.sendToServer(event);
    }
}
