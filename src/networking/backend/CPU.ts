import type Game from "../../Game.js";
import {type Event} from "../Events.js"
import {TurnState} from "../../GameStates.js";
import {Side} from "../../GameElement.js";

export default class CPU{
    private game:Game|undefined;
    get mySide(){ return this.game?.player(Side.A) === this ? Side.A : Side.B; }

    setGame(game:Game){this.game=game;}

    send(event:Event<any>){

    }

    takeAction(){
        if(!this.game) return;

        if(this.game.state instanceof TurnState && this.game.state.turn === this.mySide){

        }
    }
}