import {Scene, startTime} from "./Scene.js";
import {camera} from "../clientConsts.js";
import {Vector3} from "three";
import {button, buttonId, registerDrawCallback} from "../ui.js";
import {setScene} from "../../index.js";
import {GameScene} from "./GameScene.js";
import {DeckBuildScene} from "./DeckBuildScene.js";

export class MainMenuScene extends Scene{
    private readonly buttonIds = {
        start:buttonId(),
        buildDeck:buttonId()
    }
    private readonly releaseDrawCallback;
    constructor() {
        super();

        this.releaseDrawCallback=registerDrawCallback(0, (p5, scale)=>{
            button(p5,
                p5.width/2-scale/2, p5.height/2-scale*0.15, scale, scale*0.3,
                "Start", ()=>{
                    setScene(()=>new GameScene());
                }, scale*0.8, this.buttonIds.start);
            button(p5,
                p5.width/2-scale/2, p5.height/2+scale*0.2, scale, scale*0.3,
                "Build Deck", ()=>{
                    setScene(()=>new DeckBuildScene());
                }, scale*0.8, this.buttonIds.buildDeck);
        })
    }
    exit(): void {
        this.releaseDrawCallback();
    }

    tick(): void {
        let angle = ((new Date().valueOf()-startTime)*0.0005)%(Math.PI*2);
        const size = 400;
        camera.position.lerp(new Vector3(Math.sin(angle)*size, 400, Math.cos(angle)*size),0.1);
        const oldRot = camera.quaternion.clone();
        camera.lookAt(new Vector3(0,100,0));
        camera.quaternion.slerp(oldRot, 0.9);
    }

}
