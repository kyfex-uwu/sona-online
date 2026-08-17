import {Scene} from "./Scene.js";
import {RequestServerDumpAction} from "../../networking/Events.js";
import {getLocalGame} from "../../networking/frontend/LocalGameServer.js";
import {network} from "../../networking/Server.js";


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
    }
    exit(): void {
        getLocalGame().release();
    }

    tick(): void {
        getLocalGame().tick();
        getLocalGame().visualTick();
    }

}
