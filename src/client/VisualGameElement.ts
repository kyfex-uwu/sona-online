import type VisualGame from "./VisualGame.js";
import type {Side} from "../GameElement.js";
import type ElementScene from "./ElementScene.js";

//A game element that has a model and should update
export abstract class VisualGameElement{
    constructor(scene:ElementScene) {
        this.elScene=scene;
    }
    //the "physics" of a game element. i think this should be deprecated i think
    abstract tick():void;
    /**
     * Run every frame, this updates the game element visually. May update while not enabled
     * @param parent VisualGame this is a part of
     */
    abstract visualTick():void;
    //Removes this game element from the game
    removeFromScene(){}

    public readonly elScene:ElementScene;
}

//A game element that belongs to a specific side
export interface SidedVisualGameElement extends SmartGameElement{
    //Returns the side this element belongs to
    getSide():Side;
}

export interface SmartGameElement{
    get game():VisualGame;
}