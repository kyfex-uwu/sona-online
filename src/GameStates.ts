import {sideTernary} from "./consts.js";
import type Game from "./Game.js";

export abstract class GameState{
    abstract tick(game:Game):void;
}

export class BeforeGameState extends GameState{
    tick(game:Game){
        if(sideTernary(game.side, game.fieldsA, game.fieldsB).some(v=>v!==undefined)){

        }
    }
}
