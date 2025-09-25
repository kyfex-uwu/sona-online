import VisualGame, {ViewType} from "./VisualGame.js";
import {button, buttonId, registerDrawCallback} from "./ui.js";
import {DrawAction, StartRequestEvent} from "../networking/Events.js";
import {other, type Side} from "../GameElement.js";
import {BeforeGameState, GameState, TurnState} from "../GameStates.js";
import  VisualCard from "./VisualCard.js";
import type {Stat} from "../Card.js";
import {network} from "../networking/Server.js";
import {sideTernary} from "../consts.js";

export enum StateFeatures{
    FIELDS_PLACEABLE,
    FIELDS_SELECTABLE,
    ALL_FIELDS_SELECTABLE,
    DECK_DRAWABLE,
    CAN_DISCARD_FROM_HAND,
}

//A game state for a {@link VisualGame}
export abstract class VisualGameState<T extends GameState>{
    protected readonly game;
    public readonly features:Set<StateFeatures> = new Set();
    constructor(game:VisualGame) {
        this.game=game;
    }
    abstract visualTick():void;
    init(){}
    swapAway(){}
    getNonVisState(){
        return this.game.getGame().state as unknown as T;
    }

    hasFeatures(...features:StateFeatures[]){
        for(const feature of features) if(!this.features.has(feature)) return false;
        return true;
    }
    addFeatures(...features:StateFeatures[]){
        for(const feature of features) this.features.add(feature);
    }
    canSelectHandCard(card:VisualCard){
        return true;
    }
}

//During this, the player chooses a lv1 card to place. After it's placed, change to {@link VChoosingStartState}
export class VBeforeGameState extends VisualGameState<BeforeGameState>{
    init() {
        super.init();
        this.addFeatures(StateFeatures.FIELDS_PLACEABLE);
    }

    visualTick() {
        if(sideTernary(this.game.getMySide(), this.game.fieldsA, this.game.fieldsB).some(v=>v.getCard()!==undefined)){
            this.game.setState(new VChoosingStartState(this.game), this.game.getGame().state);
            //draw overlay (? what)
        }
    }

    canSelectHandCard(card: VisualCard): boolean {
        return card.logicalCard.cardData.level === 1;
    }
}

//During this state the player chooses if they want to go first or second. Should swap to {@link VTurnState} when coin is finished flipping
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
        this.game.cursorActive=false;
    }

    visualTick() {}
    swapAway() {
        super.swapAway();
        this.removeDraw();
    }
}

/**
 * During this state, the player can place a card, draw a card, attack, do a card action, or pass
 *
 * If the player click on a placed card, should swap to {@link VAttackingState}
 */
export class VTurnState extends VisualGameState<TurnState>{
    public readonly currTurn;
    constructor(currTurn:Side, game:VisualGame) {
        super(game);
        this.currTurn=currTurn;

    }
    init() {
        super.init();
        this.addFeatures(StateFeatures.FIELDS_SELECTABLE,
            StateFeatures.FIELDS_PLACEABLE,
            StateFeatures.DECK_DRAWABLE);

        if(this.game.getGame().miscData.isFirstTurn && this.currTurn === this.game.getMySide()) {
            sideTernary(this.currTurn, this.game.deckA, this.game.deckB).drawCard();
            network.sendToServer(new DrawAction({}));
        }
    }

    visualTick(): void {
        if(this.game.getMySide() === this.currTurn){
            const handSize=sideTernary(this.game.getMySide(), this.game.getGame().handA, this.game.getGame().handB).length + (this.game.selectedCard !== undefined ? 1 : 0 );
            if(handSize > 5){
                this.features.clear();
                this.features.add(StateFeatures.CAN_DISCARD_FROM_HAND);
            }else{
                this.features.delete(StateFeatures.CAN_DISCARD_FROM_HAND);
                this.addFeatures(StateFeatures.FIELDS_SELECTABLE,
                    StateFeatures.FIELDS_PLACEABLE,
                    StateFeatures.DECK_DRAWABLE);
            }
            if(handSize > 4){
                this.features.delete(StateFeatures.DECK_DRAWABLE);
            }else{
                this.features.add(StateFeatures.DECK_DRAWABLE);
            }
        }else{
            this.features.clear();
        }
    }
    decrementTurn(){
        const state = this.game.getGame().state;
        if(state instanceof TurnState) {
            if(state.decrementTurn(true)){
                this.game.setState(new VTurnState(other(state.turn), this.game),new TurnState(this.game.getGame(), other(state.turn)));
            }
        }
    }
    getActionsLeft(){
        const state = this.game.getGame().state;
        return state instanceof TurnState ? state.actionsLeft : 0;
    }
    canSelectHandCard(card: VisualCard): boolean {
        return card.logicalCard.cardData.level === 1 || sideTernary(this.game.getMySide(), this.game.fieldsA, this.game.fieldsB).some(field =>
            field.getCard()?.logicalCard.cardData.level === card.logicalCard.cardData.level-1);
    }
}

//During this state the player either chooses which stat to attack with, which card action to attack with, or cancel
export class VAttackingState extends VisualGameState<TurnState>{
    public cardIndex;
    public readonly parentState;
    public readonly attackData:{
        type?:Stat|"card",
        cardAttack?:string,
    }={};
    constructor(cardIndex:1|2|3, game:VisualGame) {
        super(game);
        this.cardIndex=cardIndex;
        this.parentState = game.state as VTurnState;
    }
    init() {
        super.init();
        this.game.changeView(sideTernary(this.game.getMySide(), ViewType.FIELDS_A, ViewType.FIELDS_B));

        this.addFeatures(StateFeatures.ALL_FIELDS_SELECTABLE);
    }

    visualTick(): void {}
    swapAway() {
        super.swapAway();
        this.game.changeView(sideTernary(this.game.getMySide(), ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));
    }

    returnToParent(){
        this.game.setState(this.parentState, this.getNonVisState());
    }
}
