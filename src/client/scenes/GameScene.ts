import {Scene} from "./Scene.js";
import {RequestServerDumpAction} from "../../networking/Events.js";
import {getLocalGame} from "../../networking/LocalGameServer.js";
import {network} from "../../networking/Server.js";
import {tempHowToUse} from "../ui.js";


export class GameScene extends Scene{
    constructor() {
        super();

// @ts-ignore
        window.logGame =
            ()=> getLocalGame();
// @ts-ignore
        window.serverDump =
            ()=>network.sendToServer(new RequestServerDumpAction({}));

        console.log("important lines of code:\n\n" +
            "logGame() outputs the game as the CLIENT sees it\n\n" +
            "serverDump() outputs the game as the SERVER sees it\n\n" +
            "showNetworkLogs=true turns on packet logging");

        tempHowToUse("Sonic Stallion", "Any time you have 0 cards on your field, you can place Sonic Stallion on your field. " +
            "Additionally, if you have no cards on your field at the end of your opponent's turn, you have an option to place " +
            "Sonic Stallion down. You can pick the slot to put Sonic Stallion in, or press Finish to not place Sonic Stallion.");

    }
    exit(): void {
        getLocalGame().release();
    }

    tick(): void {
        getLocalGame().tick();
        getLocalGame().visualTick();
    }

}
