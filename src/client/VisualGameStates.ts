import VisualGame, {ViewType} from "./VisualGame.js";
import {button, buttonId, registerDrawCallback} from "./ui.js";
import {DrawAction, StartRequestEvent} from "../networking/Events.js";
import {other, type Side} from "../GameElement.js";
import {BeforeGameState, GameState, TurnState, VDCWGuess} from "../GameStates.js";
import VisualCard from "./VisualCard.js";
import type {Stat} from "../Card.js";
import {network} from "../networking/Server.js";
import {sideTernary, wait} from "../consts.js";
import {camera, clickListener, removeClickListener} from "./clientConsts.js";
import {Euler, Group, Quaternion, Vector3} from "three";
import VisualCardClone from "./VisualCardClone.js";
import {GameMiscDataStrings} from "../Game.js";

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
        console.log("creating "+this.constructor.name)
    }
    visualTick(){};
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

    swapAway() {
        super.swapAway();
        this.removeDraw();
    }
}

//i think this is deprecated? todo
export interface Decrementable{
    readonly __isDecrementableInterface:boolean;
    decrementTurn():void;
}
export const isDecrementable = (state:VisualGameState<any>) => (state as unknown as Decrementable).__isDecrementableInterface !== undefined;

/**
 * During this state, the player can place a card, draw a card, attack, do a card action, or pass
 *
 * If the player click on a placed card, should swap to {@link VAttackingState}
 */
export class VTurnState extends VisualGameState<TurnState> implements Decrementable{
    public readonly currTurn;
    public canInit;
    constructor(currTurn:Side, game:VisualGame, canInit=true) {
        super(game);
        this.currTurn=currTurn;
        this.canInit=canInit;

    }
    private initedAlready=false;
    init() {
        super.init();
        this.addFeatures(StateFeatures.FIELDS_SELECTABLE,
            StateFeatures.FIELDS_PLACEABLE,
            StateFeatures.DECK_DRAWABLE);

        if(!this.initedAlready && this.canInit) {
            if (this.currTurn === this.game.getMySide()) {
                //dont even think about uncommenting this unless youre gonna fix brownie
                // this.game.getGame().getMiscData(GameMiscDataStrings.FIRST_TURN_WAITER)!.then(()=>{
                //     sideTernary(this.currTurn, this.game.deckA, this.game.deckB).drawCard();
                //     network.sendToServer(new DrawAction({}));
                // });
            }
            if (!sideTernary(this.currTurn, this.game.fieldsA, this.game.fieldsB).some(card => card !== undefined)) {
                //something something crisis mode
            }
            this.initedAlready=true;
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
    readonly __isDecrementableInterface=true;
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
        if(sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards.length>5) return true;
        return card.logicalCard.cardData.level === 1 || sideTernary(this.game.getMySide(), this.game.fieldsA, this.game.fieldsB).some(field =>
            (field.getCard()?.logicalCard.cardData.level ?? 0)+1 >= card.logicalCard.cardData.level);
    }
}
//todo: i think theres only gonna be 2 cancellable states? (attacking and pick+subclasses) so do we really need this
export interface Cancellable{
    isCancellable():boolean;
    cancel():void;
}
export const isCancellable = (inst:any) => inst.isCancellable instanceof Function && inst.cancel instanceof Function;

//During this state the player either chooses which stat to attack with, which card action to attack with, or cancel
export class VAttackingState extends VisualGameState<TurnState> implements Cancellable, Decrementable{
    public cardIndex;
    public readonly parentState;
    public readonly attackData:{
        type?:Stat,
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

    swapAway() {
        super.swapAway();
        this.game.changeView(sideTernary(this.game.getMySide(), ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));
    }

    isCancellable(){ return true; }
    cancel(){
        this.game.setState(this.parentState, this.getNonVisState());
    }
    canSelectHandCard(card: VisualCard): boolean {
        return false;
    }

    readonly __isDecrementableInterface=true;
    decrementTurn() {
        this.parentState.decrementTurn();
    }
}

export enum EndType{
    CANCEL,
    FINISH,
    BOTH,
    NONE
}
export class VPickCardsState extends VisualGameState<TurnState> implements Cancellable, Decrementable {
    public readonly cards;
    private readonly parentState;
    private listener?:number;
    private readonly onPick;
    public readonly endType;
    public readonly onFinish;
    constructor(game:VisualGame, parentState:[VisualGameState<any>, GameState], cards: VisualCard[], onPick:(card:VisualCardClone)=>void,
                endType:EndType, onFinish?:()=>void) {
        super(game);
        this.cards=cards;
        this.parentState=parentState;
        this.onPick=onPick;
        this.endType=endType;
        this.onFinish=onFinish;
    }
    private initedAlready=false;
    init() {
        super.init();

        this.game.changeView(sideTernary(this.game.getMySide(), ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));

        if(!this.initedAlready) {
            this.listener = clickListener(() => {
                const intersects = this.game.raycaster.intersectObjects(this.cards
                    .map(card => card.model).filter(model => model !== undefined));
                if (intersects[0] !== undefined) {
                    // console.log(intersects[0], intersects[0].object?.parent?.parent?.parent)
                    this.onPick((intersects[0].object.parent!.parent!.parent! as Group).userData.card);
                }

                return false;
            });

            for (let i = 0; i < this.cards.length; i++) {
                this.cards[i] = new VisualCardClone(this.cards[i]!);
                this.game.addElement(this.cards[i]!);
                this.cards[i]!.populate(this.cards[i]!.logicalCard);
                this.cards[i]!.createModel().then(()=>{
                    camera.add(this.cards[i]!.model);
                });
            }

            let height=3;
            let scale=1;

            const cardsLength = this.cards.length;
            if(cardsLength<=18){
                if(cardsLength%3===0 && cardsLength>6){
                    height=3;
                }else if(cardsLength%2===0 && cardsLength>4 && cardsLength/2<=6){
                    height=2;
                }else{
                    height=Math.ceil(cardsLength/6);
                }
            }else{//fun fact! i think its impossible for this to be run
                //scale=1: 3x6
                //card dims are 5/7, 6/8 with padding
                //screen height = 3/8 = 9/24
                //screen width = 4/6 = 2/3 = 16/24
                //ratio: 9/16 effectively, if the cards are square
                console.log("gorp")
                scale = Math.sqrt(cardsLength/(16*9))*8;
                height = Math.ceil(cardsLength/16*scale);
            }

            let width = Math.ceil(cardsLength/height);
            height = Math.ceil(cardsLength/width);
            let currCard=0;
            for(let y=0;y<height;y++){
                if(y===height-1) width=cardsLength-(height-1)*width;
                for(let x=0;x<width;x++){
                    const fakeCard = this.cards[currCard];
                    currCard++;
                    if(fakeCard === undefined) break;

                    fakeCard.flipFaceup();
                    let pos = new Vector3((x-(width-1)/2)*85*scale, -(y-(height-1)/2)*119*scale, -400);
                    // console.log((x-(width-1)/2), -(y-(height-1)/2), x, y, width, height)
                    // console.log(fakeCard.logicalCard.cardData.name)
                    fakeCard.position.copy(pos);
                    fakeCard.rotation = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
                    fakeCard.scale = new Vector3(scale, scale, scale);
                }
            }
        }

        this.initedAlready=true;
    }
    swapAway() {
        super.swapAway();
        removeClickListener(this.listener!);
        this.removeCards();
    }

    canSelectHandCard(card: VisualCard): boolean {
        return false;
    }

    isCancellable(){ return this.endType === EndType.CANCEL || this.endType === EndType.BOTH; }
    cancel(){//todo: make sure this doesnt break stuff
        // let decrement=false;
        this.game.setState(this.parentState[0], this.parentState[1]);
        // if(decrement && isDecrementable(this.parentState[0]))
        //     (this.parentState[0] as unknown as Decrementable).decrementTurn();

        this.removeCards();
    }

    removeCards(){
        for(const card of this.cards){
            card.position = new Vector3(0,0,-1500);
        }
        wait(1000).then(()=>{
            for(const card of this.cards){
                card.removeFromGame();
            }
        });
    }

    readonly __isDecrementableInterface=true;
    decrementTurn() {
        if(isDecrementable(this.parentState[0]))
            (this.parentState[0] as unknown as Decrementable).decrementTurn();

    }
}
//server side picking cards state?

//--

export class VDCWPicked extends VisualGameState<VDCWGuess>{
    private readonly card;
    private readonly parentState;
    constructor(game:VisualGame, card:VisualCardClone, parentState:VTurnState) {
        super(game);
        this.card=card;
        this.parentState=parentState;
    }
}
export class VDCWGuesser extends VisualGameState<VDCWGuess>{
    private readonly parentState;
    constructor(game:VisualGame, parentState:VTurnState) {
        super(game);
        this.parentState=parentState;
    }
}
