import type VisualGame from "./VisualGame.js";
import type {Scene} from "three";
import type {Side} from "../GameElement.js";

//A game element that has a model and should update
export abstract class VisualGameElement{
    //the "physics" of a game element. i think this should be deprecated i think
    abstract tick(parent: VisualGame):void;
    /**
     * Run every frame, this updates the game element visually. May update while not enabled
     * @param parent VisualGame this is a part of
     */
    abstract visualTick(parent:VisualGame):void;
    /**
     * Adds this game element to the game
     * @param game VisualGame to add it to
     */
    addToGame(game: VisualGame){
        this.game=game;
    }
    //Removes this game element from the game
    removeFromGame(){
        this.game=undefined;
    }

    /**
     * Whether this game element is enabled
     * @deprecated
     */
    public enabled: boolean = false;
    protected game:VisualGame|undefined;
}

//A game element that belongs to a specific side
export interface SidedVisualGameElement{
    //Returns the side this element belongs to
    getSide():Side;
}
