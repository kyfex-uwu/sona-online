import {Scene} from "./Scene.js";
import VisualGame, {ViewType} from "../VisualGame.js";
import {FindGameEvent, RequestServerDumpEvent} from "../../networking/Events.js";
import cards, {specialCards} from "../../Cards.js";
import type CardData from "../../CardData.js";
import {scene} from "../clientConsts.js";
import {frontendInit} from "../../networking/LocalServer.js";
import {network} from "../../networking/Server.js";
import {tempHowToUse} from "../ui.js";

let currGame:VisualGame;
export const gameScene = {get game(){ return currGame; }}

export class GameScene extends Scene{
    public readonly game;
    constructor() {
        super();

        this.game = new VisualGame(scene);
        currGame = this.game;
        network.clientGame = this.game.getGame();

        this.game.changeView(ViewType.WHOLE_BOARD_A);
        this.game.sendEvent(new FindGameEvent({
            deck:(()=>{
                const toReturn = [];
                const alreadyAdded:{[k:string]:true} = {};
                const cardsValues = Object.values(cards);
                let oneFlag = false;
                for(let i=0;i<20;i++) {
                    if(toReturn[i] !== undefined) continue;

                    let toAdd:CardData;
                    do {
                        toAdd = cardsValues[Math.floor(Math.random() * cardsValues.length)]!;
                    }while(specialCards.has(toAdd.name) || (alreadyAdded[toAdd.name] && (i!==19 || oneFlag || toAdd.level !== 1)));

                    toReturn[i]=toAdd.name;
                    alreadyAdded[toAdd.name]=true;
                    oneFlag = oneFlag || toAdd.level === 1;
                }
                return toReturn;
            })(),
        }, undefined));

        frontendInit();

// @ts-ignore
        window.logGame =
            ()=> console.log(this.game);
// @ts-ignore
        window.serverDump =
            ()=>network.sendToServer(new RequestServerDumpEvent({}));

        console.log("important lines of code:\n\n" +
            "logGame() outputs the game as the CLIENT sees it\n\n" +
            "serverDump() outputs the game as the SERVER sees it\n\n" +
            "showNetworkLogs=true turns on packet logging");

        tempHowToUse("Sonic Stallion", "Any time you have 0 cards on your field, you can place Sonic Stallion on your field. " +
            "Additionally, if you have no cards on your field at the end of your opponent's turn, you have an option to place " +
            "Sonic Stallion down. You can pick the slot to put Sonic Stallion in, or press Finish to not place Sonic Stallion.");

    }
    exit(): void {
        this.game.release();
    }

    tick(): void {
        this.game.tick();
        this.game.visualTick();
    }

}
