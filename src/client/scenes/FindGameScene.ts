import {Scene} from "./Scene.js";
import {C2SFindGameEvent} from "../../networking/Events.js";
import {getDeck} from "./DeckBuildScene.js";
import {sendToServer} from "../clientConsts.js";

export class FindGameScene extends Scene{
    constructor(requestCPU:boolean) {
        super();

        sendToServer(new C2SFindGameEvent({
            deck:getDeck(),
            requestCPU,
        }, undefined));
    }
    exit(): void {

    }

    tick(): void {}
}
