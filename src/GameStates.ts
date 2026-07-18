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
    public get crisis(){ return this._crisis; }
    private _crisis:boolean|undefined=undefined;
    public actionsLeft=2;
    private _drawnToStart=false;
    public get drawnToStart(){ return this._drawnToStart; }
    constructor(game:Game, turn:Side){
        super(game);
        this.turn=turn;

        for(const card of sideTernary(turn,game.fieldsA,game.fieldsB))
            if(card !==undefined) card.hasAttacked=false;

        const firstTurnAwaiter = game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER);
        if(!firstTurnAwaiter?.waiting)
            firstTurnAwaiter?.resolve();

        if(sideTernary(this.turn, this.game.handA, this.game.handB).length>=5) {
            this.setDrawnToStart();
        }
    }
    setDrawnToStart(){
        if(this.crisis !== undefined || this._drawnToStart) return;

        this._drawnToStart = true;
        this._crisis=!sideTernary(this.turn, this.game.fieldsA, this.game.fieldsB).some(card => card !== undefined);
        if(this.crisis){
            this.actionsLeft=3;
            this.game.crisis(this.turn);
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
     * @param toNextTurn Should this call change the turn
     * @return If the turn should change/did change
     */
    decrementAction(suppressChanges=false, toNextTurn=false){
        this.actionsLeft--;
        if(this.actionsLeft<0||toNextTurn){
            this.game.setMiscData(GameMiscDataStrings.IS_FIRST_TURN, false);
            this.game.setMiscData(GameMiscDataStrings.LAST_ACTIONED, false);
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
