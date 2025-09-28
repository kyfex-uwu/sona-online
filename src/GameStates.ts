import type Game from "./Game.js";
import {other, type Side} from "./GameElement.js";
import {sideTernary} from "./consts.js";
import type Card from "./Card.js";

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
    public readonly crisis;
    public actionsLeft=2;
    constructor(game:Game, turn:Side, crisis?:boolean){
        super(game);
        this.turn=turn;
        for(const card of sideTernary(turn,game.fieldsA,game.fieldsB))
            if(card !==undefined) card.hasAttacked=false;
        this.crisis=crisis ?? !sideTernary(turn, game.fieldsA, game.fieldsB).some(card => card !== undefined);
        if(this.crisis) this.actionsLeft=3;
    }
    swapAway() {
        super.swapAway();
        this.game.miscData.isFirstTurn=false;
    }

    /**
     * @param suppressChanges Should this call refrain from making setting the state (useful for managing game state from visual game)
     * @return If the turn should change/did change
     */
    decrementTurn(suppressChanges=false){
        const state = this.game.state;
        if(state instanceof TurnState) {

            state.actionsLeft--;
            if(state.actionsLeft<=0){
                if(!suppressChanges)
                    this.game.state = new TurnState(this.game, other(state.turn));
                return true;
            }
        }

        return false;
    }
    serverInit(){
        const hand = sideTernary(this.game, this.game.handA, this.game.handB);
        if(hand.length>=5) return false;

        const toAdd = sideTernary(this.game, this.game.deckA, this.game.deckB).pop();
        if(toAdd===undefined) return false;

        hand.push(toAdd);
        return true;
    }
}

export class PickCardsState extends GameState{
    public readonly parentState;
    public readonly cardsToPick;
    public readonly onPick;
    constructor(game:Game, parentState:TurnState, cardsToPick:Array<Card>, onPick:(card:Card)=>boolean) {
        super(game);
        this.parentState=parentState;
        this.cardsToPick=cardsToPick;
        this.onPick=onPick;
    }
    //@returns If the card was picked successfully and the state should change
    pick(which:number){
        if(which>=0 && which<this.cardsToPick.length && this.onPick(this.cardsToPick[which]!)){
            return true;
        }
        return false;
    }
}
