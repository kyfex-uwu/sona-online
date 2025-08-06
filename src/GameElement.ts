import type Game from "./Game.js";
import type {Scene} from "three";

export enum Side{
    YOU,
    THEM
}

export interface GameElement{
    getSide():Side;
    tick(parent: Game):void;
    visualTick(parent:Game):void;
    addToScene(scene:Scene, parent: Game):void;
}
