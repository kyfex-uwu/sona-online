import {type ClientEvent, DetermineStarterEvent, GameStartEvent, ServerEvent} from "./Events.js";
import cards from "../Cards.js";
import Game from "../Game.js";
import {Side} from "../GameElement.js";

let online = false;
const eventIdGenerator = ()=>Math.random();

let game:Game|undefined = undefined;
export function setGame(gameP:Game){
    game=gameP;
}

export function processEvent(event:ServerEvent){
    event.apply(game!);
}
export function sendEvent(event:ClientEvent){
    if(!online){
        setTimeout(()=> {
            switch (event.type) {
                case "FindGame":
                    //assign game to player
                    processEvent(new GameStartEvent((()=>{
                        const options = Object.keys(cards);
                        const toReturn=[];
                        for(let i=0;i<20;i++){
                            toReturn.push({id:eventIdGenerator(), name:options.splice(Math.floor(Math.random()*options.length),1)[0]!})
                        }
                        return toReturn;
                    })(),(()=>{
                        const options = Object.keys(cards);
                        const toReturn=[];
                        for(let i=0;i<20;i++){
                            toReturn.push({id:eventIdGenerator(), name:options.splice(Math.floor(Math.random()*options.length),1)[0]!})
                        }
                        return toReturn;
                    })()));
                    break;
                case "StartRequest"://todo
                    processEvent(new DetermineStarterEvent(Side.YOU,false));
                    break;
                case "DrawAction":
                    game!.actionsLeft--;
                    //processEvent(new )
                    //send event to other player
                    break;
            }
        },20+Math.random()*100);
        return;
    }
}
