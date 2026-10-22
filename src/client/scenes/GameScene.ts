import {Scene} from "./Scene.js";
import {RequestServerDumpAction} from "../../networking/Events.js";
import {getLocalGame} from "../../networking/frontend/LocalGameServer.js";
import {sendToServer} from "../clientConsts.js";


export class GameScene extends Scene{
    public readonly isCpuGame: boolean;
    constructor(isCpuGame:boolean) {
        super();
        this.isCpuGame=isCpuGame;

// @ts-expect-error
        window.logGame =
            ()=> getLocalGame();
// @ts-expect-error
        window.serverDump =
            ()=>sendToServer(new RequestServerDumpAction({}));

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
