import express from 'express';
import * as ws from 'ws';
const website = new express();

import { fileURLToPath } from 'url';
import {network} from "./dist/networking/Server.js";
import {backendInit} from "./dist/networking/BackendServer.js";
const __dirname=fileURLToPath(import.meta.url).slice(0,"/main.js".length*-1);

const server = website.listen(4000);
console.log("App hosted at http://localhost:4000");

//--

website.get("/", (req, res) =>
    res.sendFile(__dirname + "/assets/index.html"));
website.use("/src", express.static(__dirname + "/dist"));
website.use("/assets", express.static(__dirname + "/assets"));

const wsServer = new ws.WebSocketServer({ noServer: true });
backendInit();
server.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (ws) => {
        const sender = {send:event=>ws.send(event.serialize())};
        ws.on("message", (message) => {
            try{
                network.receiveFromClient(JSON.parse(message.toString()), sender);
            }catch(e){
                ws.send("{\"error\":\"Couldn't process event\"}");
            }
        })
    })
})
