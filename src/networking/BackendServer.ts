import {network} from "./Server.js";

export function backendInit(){
    console.log("Backend initialized");
}

network.sendToClients = async (event) => {

}
network.receiveFromClient= (event) => {
    console.log("Received "+JSON.stringify(event))
}
