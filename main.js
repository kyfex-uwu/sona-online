import express from 'express';
const website = new express();

import { fileURLToPath } from 'url';
const __dirname=fileURLToPath(import.meta.url).slice(0,"/main.js".length*-1);

const server = website.listen(4000);
console.log("App hosted at http://localhost:4000");

//--

website.use("/src", express.static(__dirname + "/dist"));
website.use("/", express.static(__dirname + "/public"));
