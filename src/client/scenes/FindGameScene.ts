import {Scene} from "./Scene.js";
import {FindGameEvent} from "../../networking/Events.js";
import {getDeck} from "./DeckBuildScene.js";
import {sendToServer} from "../clientConsts.js";

export class FindGameScene extends Scene{
    constructor(requestCPU:boolean) {
        super();

        sendToServer(new FindGameEvent({
            deck:getDeck(),
            requestCPU,
        }, undefined));
    }
    exit(): void {

    }

    tick(): void {}
}
