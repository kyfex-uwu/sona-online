import type VisualGame from "./VisualGame.js";
import type {Scene} from "three";
import type {Side} from "../GameElement.js";

export interface VisualGameElement{
    getSide():Side;
    tick(parent: VisualGame):void;
    visualTick(parent:VisualGame):void;
    addToScene(scene:Scene, parent: VisualGame):void;
}
