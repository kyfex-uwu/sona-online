import VisualGame, {ViewType} from "./VisualGame.js";
import {cSideTernary} from "./clientConsts.js";
import {button, buttonId, registerDrawCallback} from "./ui.js";
import {StartRequestEvent} from "../networking/Events.js";
import {other, type Side} from "../GameElement.js";
import {BeforeGameState, GameState, TurnState} from "../GameStates.js";
import {game} from "../index.js";
import type VisualCard from "./VisualCard.js";

export abstract class VisualGameState<T extends GameState>{
    protected readonly game;
    constructor(game:VisualGame) {
        this.game=game;
    }
    abstract visualTick(game: VisualGame):void;
    init(){}
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
            game.setState(new VChoosingStartState(game), game.getGame().state);
            //draw overlay (? what)
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
    init() {
        super.init();
        game.cursorActive=false;
    }

    visualTick(game: VisualGame) {}
    swapAway(game: VisualGame) {
        super.swapAway(game);
        this.removeDraw();
    }
}

export class VTurnState extends VisualGameState<TurnState>{
    public readonly currTurn;
    constructor(currTurn:Side, game:VisualGame) {
        super(game);
        this.currTurn=currTurn;

        cSideTernary(currTurn, game.deckA, game.deckB).drawCard(game);
    }
    init() {
        super.init();
        this.reinit();
    }

    visualTick(game: VisualGame): void {
        if(game.getMySide() === this.currTurn){
            cSideTernary(game, game.runawayA, game.runawayB).enabled =
                cSideTernary(game, game.getGame().handA, game.getGame().handB).length + (game.selectedCard !== undefined ? 1 : 0 )
                    > 5;
        }
    }
    decrementTurn(){
        const state = this.game.getGame().state;
        if(state instanceof TurnState) {
            state.actionsLeft--;
            if(state.actionsLeft<=0){
                game.setState(new VTurnState(other(state.turn), this.game),new TurnState(other(state.turn)));
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

    reinit(){
        if(this.currTurn === game.getMySide()){
            // for(const field of sideTernary(currTurn, game.fieldsA, game.fieldsB))
            cSideTernary(this.currTurn, game.handA, game.handB).enabled=true;
            cSideTernary(this.currTurn, game.deckA, game.deckB).enabled=true;
            for(const field of cSideTernary(this.currTurn, game.fieldsA, game.fieldsB))
                field.enabled=true;
        }
        return this;
    }
}
export class VAttackingState extends VisualGameState<TurnState>{
    public readonly card;
    public readonly parentState;
    public readonly attackData:{
        type?:"red"|"yellow"|"blue"|"card",
        cardAttack?:string,
    }={};
    constructor(card:VisualCard, game:VisualGame) {
        super(game);
        this.card=card;
        this.parentState = game.state as VTurnState;
    }
    init() {
        super.init();
        game.changeView(cSideTernary(game, ViewType.FIELDS_A, ViewType.FIELDS_B));

        for(const field of game.fieldsA) field.enabled=true;
        for(const field of game.fieldsB) field.enabled=true;
    }

    visualTick(game: VisualGame): void {
    }
    swapAway(game: VisualGame) {
        super.swapAway(game);
        game.changeView(cSideTernary(game, ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));

        for(const field of game.fieldsA) field.enabled=false;
        for(const field of game.fieldsB) field.enabled=false;
    }

    returnToParent(){
        this.game.setState(this.parentState.reinit(), this.getNonVisState());
    }
}
