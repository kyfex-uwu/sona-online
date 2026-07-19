import {
    AcceptEvent,
    Event,
    GameEvent,
    InvalidEvent, PerchanceEvent,
    RejectEvent,
    SerializableClasses,
    type SerializableType
} from "./Events.js";
import {gameReceiveFromServer} from "./LocalGameServer.js";
import {log, websocket, websocketReady} from "../client/clientConsts.js";
import {eventReplyIds} from "./Server.js";

const waitingFor:({filter:(event:Event<any>)=>boolean,callback:(event:Event<any>)=>boolean})[] = [];
export function waitFor(filter:(event:Event<any>)=>boolean, callback:(event:Event<any>)=>boolean){
    waitingFor.push({filter,callback});
}

websocketReady.then(() => {
    websocket.onmessage = (message:MessageEvent<any>) => {
        const parsed = JSON.parse(message.data.toString());
        if(parsed.error !== undefined) log("Server error: "+parsed.error)
        else receiveFromServer(parsed);
    }
});

export async function receiveFromServer(packed:{
    type:string,
    data:SerializableType,
    id:string,
}) {
    //todo: this smells like vulnerability (but less!)
    const event = new (SerializableClasses[packed.type] || InvalidEvent)(
        //@ts-ignore
        packed.data, null, null, packed.id) as Event<any>;
    if(event instanceof AcceptEvent) log(`%c accepted event ${event}`, "color:green");
    if(event instanceof RejectEvent) log(`%c rejected event ${event.id}`, "color:red");
    if(event instanceof PerchanceEvent) log(`%c perchanced event ${event.id}`, "color:yellow");

    if(eventReplyIds[event.id] !== undefined){
        (eventReplyIds[event.id]?._callback||(()=>{}))(event);
        return;
    }

    for(let i=0;i<waitingFor.length;i++){
        if(waitingFor[i]!.filter(event)){
            let processNormally = waitingFor[i]!.callback(event);
            waitingFor.splice(i,1);
            if(!processNormally) return;
            else break;
        }
    }
    if(event instanceof GameEvent) gameReceiveFromServer(event);
}