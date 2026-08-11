import express from 'express';
import * as ws from 'ws';
const website = new express();

import { fileURLToPath } from 'url';
import {flags} from "./dist/networking/Server.js";
import {backendInit, receiveFromClient} from "./dist/networking/BackendServer.js";
const __dirname=fileURLToPath(import.meta.url).slice(0,"/main.js".length*-1);

if(process.argv[2] === "dev") {
    (await import("./dev.js")).init(website);
}
const server = website.listen(4000);

//--

website.get("/", (req, res) =>
    res.sendFile(__dirname + "/assets/index.html"));
website.use("/src", express.static(__dirname + "/dist"));
website.use("/assets", express.static(__dirname + "/assets"));

website.get("/flags", (req, res) =>
    res.sendFile(__dirname + "/assets/flags.html"));
website.get("/api/flags", (req, res)=>{
    const toSend={};
    for(const flagName in flags){
        toSend[flagName]=flags[flagName].val;
    }
    res.send(JSON.stringify(toSend));
});
website.use(express.text());
website.post("/api/flags/:flag", (req, res)=>{
    flags[req.params.flag].val=JSON.parse(req.body);
});

backendInit(server);