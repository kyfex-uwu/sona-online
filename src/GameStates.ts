import type Game from "./Game.js";

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
