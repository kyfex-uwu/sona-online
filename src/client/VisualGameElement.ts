import type VisualGame from "./VisualGame.js";
import type {Side} from "../GameElement.js";

//A game element that has a model and should update
export abstract class VisualGameElement{
    constructor(game:VisualGame) {
        this.game=game;
    }
    //the "physics" of a game element. i think this should be deprecated i think
    abstract tick():void;
    /**
     * Run every frame, this updates the game element visually. May update while not enabled
     * @param parent VisualGame this is a part of
     */
    abstract visualTick():void;
    //Removes this game element from the game
    removeFromGame(){}

    public readonly game:VisualGame;
}

//A game element that belongs to a specific side
export interface SidedVisualGameElement{
    //Returns the side this element belongs to
    getSide():Side;
}
