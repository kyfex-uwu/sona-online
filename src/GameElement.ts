import type Game from "./Game.js";
import type {Scene} from "three";

export interface GameElement{
    tick(parent: Game):void;
    visualTick(parent:Game):void;
    addToScene(scene:Scene, parent: Game):void;
}
