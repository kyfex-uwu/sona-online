import type Game from "./Game.js";
import type {Side} from "./GameElement.js";

export abstract class GameState{
    abstract tick(game:Game):void;
}

export class BeforeGameState extends GameState{
    tick(game:Game){
        if(game.fieldsA.some(v=>v!==undefined) &&
            game.fieldsB.some(v=>v!==undefined)){
            //game.player(Side.A)?.send()
        }
    }
}

export class TurnState extends GameState{
    public readonly turn;
    public actionsLeft=2;
    constructor(turn:Side){
        super();
        this.turn=turn;
    }
    tick(game: Game): void {
    }
}
