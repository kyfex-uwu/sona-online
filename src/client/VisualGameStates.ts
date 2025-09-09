import VisualGame from "./VisualGame.js";
import {cSideTernary} from "./clientConsts.js";
import {button, buttonId, registerDrawCallback} from "./ui.js";
import {StartRequestEvent} from "../networking/Events.js";
import {other, type Side} from "../GameElement.js";
import {BeforeGameState, GameState, TurnState} from "../GameStates.js";
import {game} from "../index.js";

export abstract class VisualGameState<T extends GameState>{
    protected readonly game;
    constructor(game:VisualGame) {
        this.game=game;
    }
    abstract visualTick(game: VisualGame):void;
    swapAway(game:VisualGame){}
    getNonVisState(){
        return this.game.getGame().state as unknown as T;
    }
}
export class VBeforeGameState extends VisualGameState<BeforeGameState>{
    visualTick(game: VisualGame) {
        if(cSideTernary(game, game.fieldsA, game.fieldsB).some(v=>v.getCard()!==undefined)){
            for(const field of cSideTernary(game, game.fieldsA, game.fieldsB))
                field.enabled=false;
            cSideTernary(game, game.handA, game.handB).enabled=false;
            game.state = new VChoosingStartState(game);
            //draw overlay
        }
    }
}
export class VChoosingStartState extends VisualGameState<BeforeGameState>{
    private readonly removeDraw;
    private picked=false;
    private timer=0;
    private readonly buttonIds:[number,number,number]=[buttonId(), buttonId(), buttonId()];
    constructor(game:VisualGame) {
        super(game);
        game.cursorActive=false;
        this.removeDraw = registerDrawCallback(0, (p5, scale) => {
            p5.background(30,30,30,150);
            if(!this.picked) {
                button(p5, p5.width / 2 - scale * 0.5, p5.height / 2 - scale * 0.8, scale, scale * 0.5, "Go First", () => {
                    this.game.sendEvent(new StartRequestEvent({
                        which: "first",
                    }));
                    this.picked = true;
                }, scale, this.buttonIds[0]);
                button(p5, p5.width / 2 - scale * 0.5, p5.height / 2 - scale * 0.25, scale, scale * 0.5, "Go Second", () => {
                    this.game.sendEvent(new StartRequestEvent({
                        which: "second",
                    }));
                    this.picked = true;
                }, scale, this.buttonIds[1]);
                button(p5, p5.width / 2 - scale * 0.5, p5.height / 2 + scale * 0.3, scale, scale * 0.5, "No Preference", () => {
                    this.game.sendEvent(new StartRequestEvent({
                        which: "nopref",
                    }));
                    this.picked = true;
                }, scale, this.buttonIds[2]);
            }else{
                p5.textAlign(p5.CENTER,p5.CENTER);
                p5.textSize(scale/3);
                p5.text("Waiting"+".".repeat(this.timer), p5.width/2,p5.height/2);

                this.timer+=0.02;
                if(this.timer>=4) this.timer=0;
            }
        });
    }
    visualTick(game: VisualGame) {

    }
    swapAway(game: VisualGame) {
        super.swapAway(game);
        this.removeDraw();
    }
}

export class VTurnState extends VisualGameState<TurnState>{
    private readonly currTurn;
    constructor(currTurn:Side, game:VisualGame) {
        super(game);
        game.getGame().state = new TurnState(currTurn);
        this.currTurn=currTurn;

        cSideTernary(currTurn, game.deckA, game.deckB).drawCard(game);
        if(currTurn === game.getMySide()){
            // for(const field of sideTernary(currTurn, game.fieldsA, game.fieldsB))
            cSideTernary(currTurn, game.handA, game.handB).enabled=true;
            cSideTernary(currTurn, game.deckA, game.deckB).enabled=true;
            for(const field of cSideTernary(currTurn, game.fieldsA, game.fieldsB))
                field.enabled=true;
        }
    }
    visualTick(game: VisualGame): void {

    }
    decrementTurn(){
        const state = this.game.getGame().state;
        if(state instanceof TurnState) {
            state.actionsLeft--;
            if(state.actionsLeft<=0){
                game.state = new VTurnState(other(state.turn), this.game);
            }
        }
    }
    getActionsLeft(){
        const state = this.game.getGame().state;
        return state instanceof TurnState ? state.actionsLeft : 0;
    }
    swapAway(game: VisualGame) {
        super.swapAway(game);
        if(this.currTurn === game.getMySide()){
            // for(const field of sideTernary(currTurn, game.fieldsA, game.fieldsB))
            cSideTernary(this.currTurn, game.handA, game.handB).enabled=false;
            cSideTernary(this.currTurn, game.deckA, game.deckB).enabled=false;
            for(const field of cSideTernary(this.currTurn, game.fieldsA, game.fieldsB))
                field.enabled=false;
        }
    }
}
