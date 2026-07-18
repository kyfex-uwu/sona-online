import {Event, GameEvent, InvalidEvent, SerializableClasses, type SerializableType} from "./Events.js";
import {gameReceiveFromServer} from "./LocalGameServer.js";
import {log, websocket, websocketReady} from "../client/clientConsts.js";

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
    // log("%c -> "+packed.type+"\n"+event.serialize(),
    //     `background:${(logColors[packed.type]||"#000")+"2"}; color:${logColors[packed.type]||"#fff"}`);

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