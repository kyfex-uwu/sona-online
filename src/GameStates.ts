import type Game from "./Game.js";

export abstract class GameState{
    abstract tick(game:Game):void;
}

export class BeforeGameState{
    tick(game:Game){

    }
}
