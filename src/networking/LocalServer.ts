import {network} from "./Server.js";

export function frontendInit(){
    console.log("network initialized :D")
}

const websocket = new WebSocket("ws://"+window.location.host);
const websocketReady = new Promise(r=>websocket.addEventListener("open",r));
websocketReady.then(() => {
    websocket.onmessage = (message:MessageEvent<any>) => {
        const parsed = JSON.parse(message.data.toString());
        if(parsed.error !== undefined) console.log("Server error: "+parsed.error)
        else network.receiveFromServer(parsed);
    }
})

network.sendToServer = async (event) => {
    await websocketReady;
    websocket.send(event.serialize());
}
network.receiveFromServer = (event) => {
    console.log(event.id)
}
