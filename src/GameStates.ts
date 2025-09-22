import type Game from "./Game.js";
import type {Side} from "./GameElement.js";

//A logical game state
export abstract class GameState{
    abstract tick(game:Game):void;
}

//Before anyone's turn, while the players are picking starting cards. Should swap to a {@link TurnState}
export class BeforeGameState extends GameState{
    tick(game:Game){
        if(game.fieldsA.some(v=>v!==undefined) &&
            game.fieldsB.some(v=>v!==undefined)){
            //game.player(Side.A)?.send()
        }
    }
}

//During a player's turn
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
