import type Game from "./Game.js";
import {other, type Side} from "./GameElement.js";

//A logical game state
export abstract class GameState{
    protected game:Game;
    constructor(game:Game) {
        this.game=game;
    }
    swapAway(){}
}

//Before anyone's turn, while the players are picking starting cards. Should swap to a {@link TurnState}
export class BeforeGameState extends GameState{}

//During a player's turn
export class TurnState extends GameState{
    public readonly turn;
    public actionsLeft=2;
    constructor(game:Game, turn:Side){
        super(game);
        this.turn=turn;
    }
    swapAway() {
        super.swapAway();
        this.game.miscData.isFirstTurn=false;
    }

    /**
     * @param suppressChanges Should this call refrain from making setting the state (useful for managing game state from visual game)
     * @return If the turn should change, if changes were suppressed
     */
    decrementTurn(suppressChanges=false){
        const state = this.game.state;
        if(state instanceof TurnState) {

            state.actionsLeft--;
            if(state.actionsLeft<=0){
                if(suppressChanges) return true;
                this.game.state = new TurnState(this.game, other(state.turn));
            }
        }

        return false;
    }
}
