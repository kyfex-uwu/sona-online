import {Event, GameStartEvent, InvalidEvent, SerializableClasses, type SerializableType} from "./Events.js";
import {gameScene} from "../client/scenes/GameScene.js";
import {log} from "../client/clientConsts.js";
import {eventReplyIds} from "./Server.js";

async function receiveFromServer(packed:{
    type:string,
    data:SerializableType,
    id:string,
}) {
    //todo: this smells like vulnerability (but less!)
    const event = new (SerializableClasses[packed.type] || InvalidEvent)(
        //@ts-ignore
        packed.data, null, null, packed.id) as Event<any>;
    log("%c -> "+packed.type+"\n"+event.serialize(),
        `background:${(logColors[packed.type]||"#000")+"2"}; color:${logColors[packed.type]||"#fff"}`);
    if(game === undefined && !(event instanceof GameStartEvent)) {
        console.log("roaches in the cereal???");
        return;
    }

    if((eventReplyIds[game?.getGame().gameID]||{})[event.id] !== undefined){
        ((eventReplyIds[game?.getGame().gameID]||{})[event.id]?._callback||(()=>{}))(event);
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
}