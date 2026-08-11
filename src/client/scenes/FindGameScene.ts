import {Scene} from "./Scene.js";
import {network} from "../../networking/Server.js";
import {FindGameEvent} from "../../networking/Events.js";
import {getDeck} from "./DeckBuildScene.js";

export class FindGameScene extends Scene{
    constructor(requestCPU:boolean) {
        super();

        network.sendToServer(new FindGameEvent({
            deck:getDeck(),
            requestCPU,
        }, undefined));
    }
    exit(): void {

    }

    tick(): void {}
}
