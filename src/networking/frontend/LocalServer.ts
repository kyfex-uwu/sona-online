import {
    AcceptEvent,
    Event,
    GameEvent,
    GameWinDefaultEvent,
    InvalidEvent,
    PerchanceEvent,
    RejectEvent,
    type SerializableType
} from "../Events.js";
import {gameReceiveFromServer, getLocalGame} from "./LocalGameServer.js";
import {eventReplyIds, log, websocket, websocketReady} from "../../client/clientConsts.js";
import {EndGameState} from "../../GameStates.js";
import {VEndState} from "../../client/VisualGameStates.js";
import {EventWaiter} from "../../consts.js";
import {SerializableEvents} from "../SerializableShapeConsts.js";

export function loadLocalNetwork(){
    //this is here to load the file
}

export const localWaiter = new EventWaiter();

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
    const event = new (SerializableEvents[packed.type] || InvalidEvent)(
        //@ts-expect-error
        packed.data,
        undefined, packed.id) as Event<any>;
    if(event instanceof AcceptEvent) log(`%c accepted event ${event.id}`, "color:#0f0");
    if(event instanceof RejectEvent) log(`%c rejected event ${event.id}`, "color:#f00");
    if(event instanceof PerchanceEvent) log(`%c perchanced event ${event.id}`, "color:#ff0");

    if(eventReplyIds[event.id] !== undefined){
        (eventReplyIds[event.id]?._callback||(()=>{}))(event);
        return;
    }

    if(!localWaiter.process(event)) return;

    if(event instanceof GameEvent) gameReceiveFromServer(event);
    else if(event instanceof GameWinDefaultEvent){
        getLocalGame().setState(new VEndState(getLocalGame(), getLocalGame().getMySide(), "disconnect"),
            new EndGameState(getLocalGame().getGame(), getLocalGame().getMySide()));
    }
}