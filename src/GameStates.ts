import Game, {GameMiscDataStrings} from "./Game.js";
import {other, type Side} from "./GameElement.js";
import {sideTernary} from "./consts.js";
import {CardTriggerType} from "./CardData.js";

//A logical game state
export abstract class GameState{
    protected game:Game;
    constructor(game:Game) {
        this.game=game;
    }
    swapAway(){}
    init(){}
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

        const firstTurnAwaiter = game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER);
        if(!firstTurnAwaiter?.waiting)
            firstTurnAwaiter?.resolve();

        this.crisis=crisis ?? !sideTernary(turn, game.fieldsA, game.fieldsB).some(card => card !== undefined);
        if(this.crisis){
            this.actionsLeft=3;
            game.crisis(turn);
        }
    }
    swapAway() {
        super.swapAway();
    }
    private inited=false;
    init(){
        if(this.inited) return;
        this.inited=true;

        for(const card of [...this.game.fieldsA, ...this.game.fieldsB])
            card?.callAction(CardTriggerType.TURN_START, {
                self:card,
                game:this.game
            });
    }

    /**
     * @param suppressChanges Should this call refrain from making setting the state (useful for managing game state from visual game)
     * @return If the turn should change/did change
     */
    decrementTurn(suppressChanges=false){
        this.actionsLeft--;
        if(this.actionsLeft<=0){
            this.game.setMiscData(GameMiscDataStrings.IS_FIRST_TURN, false);
            if(!suppressChanges) {
                this.game.state = new TurnState(this.game, other(this.turn));

                if(this.crisis && !sideTernary(this.turn, this.game.fieldsA, this.game.fieldsB).some(card=>card!==undefined)){
                    this.game.state = new EndGameState(this.game, other(this.turn));
                }else if(this.game.getCrisis(other(this.turn))>=3){
                    this.game.state = new EndGameState(this.game, this.turn);
                }
            }
            return true;
        }

        return false;
    }
}


export class EndGameState extends GameState{
    public readonly winner:Side|undefined;
    constructor(game:Game, winner?:Side) {
        super(game);
        this.winner=winner;
    }
}
