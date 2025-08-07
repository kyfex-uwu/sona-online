import express from 'express';
import ws from 'ws';
const website = new express();

import { fileURLToPath } from 'url';
const __dirname=fileURLToPath(import.meta.url).slice(0,"/main.js".length*-1);

const server = website.listen(4000);
console.log("App hosted at http://localhost:4000");

//--

website.get("/", (req, res) =>
    res.sendFile(__dirname + "/assets/index.html"));
website.use("/src", express.static(__dirname + "/dist"));
website.use("/assets", express.static(__dirname + "/assets"));

const wsServer = new ws.Server({ noServer: true })
server.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (ws) => {
        wsServer.emit('connection', ws, req)
    })
})
