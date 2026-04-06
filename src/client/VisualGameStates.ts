import VisualGame, {ViewType} from "./VisualGame.js";
import {assets, button, buttonId, invisibleButton, registerDrawCallback, textBox} from "./ui.js";
import {StartRequestEvent} from "../networking/Events.js";
import {other, type Side} from "../GameElement.js";
import {BeforeGameState, GameState, TurnState} from "../GameStates.js";
import VisualCard, {newHighlightLock} from "./VisualCard.js";
import {Stat} from "../Card.js";
import {sideTernary, wait} from "../consts.js";
import {camera, clickListener, removeClickListener} from "./clientConsts.js";
import {Color, Euler, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, type Vector2, Vector3} from "three";
import VisualCardClone from "./VisualCardClone.js";
import {GameMiscDataStrings} from "../Game.js";
import {CardTriggerType} from "../CardData.js";

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
    deleteFeatures(...features:StateFeatures[]){
        for(const feature of features) this.features.delete(feature);
    }
    canSelectHandCard(card:VisualCard){
        return true;
    }
}

//During this, the player chooses a lv1 card to place. After it's placed, change to {@link VChoosingStartState}
export class VBeforeGameState extends VisualGameState<BeforeGameState>{
    private drawCallback: () => void = ()=>{};
    init() {
        super.init();
        this.addFeatures(StateFeatures.FIELDS_PLACEABLE);

        this.drawCallback = registerDrawCallback(0, (p5, scale)=>{
            p5.fill(255,255,255);
            textBox(p5, scale, "Place your starting level 1 card onto the field");
        });
    }

    visualTick() {
        if(sideTernary(this.game.getMySide(), this.game.fieldsA, this.game.fieldsB).some(v=>v.getCard()!==undefined)){
            this.game.setState(new VChoosingStartState(this.game), this.game.getGame().state);
        }
    }

    swapAway() {
        super.swapAway();
        this.drawCallback();
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
                p5.fill(255,255,255);
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

export const canSelectCardHighlight = newHighlightLock();
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
            this.initedAlready=true;
        }
        this.game.changeView(sideTernary(this.game.getMySide(), ViewType.WHOLE_BOARD_A, ViewType.WHOLE_BOARD_B));
    }

    visualTick(): void {
        if(this.game.getMySide() === this.currTurn && this.getActionsLeft()>0){
            const handSize=sideTernary(this.game.getMySide(), this.game.getGame().handA, this.game.getGame().handB).length + (this.game.selectedCard !== undefined ? 1 : 0 );
            if(handSize > 5){
                this.features.clear();
                this.features.add(StateFeatures.CAN_DISCARD_FROM_HAND);
            }else{
                this.features.delete(StateFeatures.CAN_DISCARD_FROM_HAND);

                const fieldCards = sideTernary(this.game.getMySide(), this.game.fieldsA, this.game.fieldsB);
                if(!this.getNonVisState().drawnToStart){
                    this.deleteFeatures(StateFeatures.FIELDS_SELECTABLE,
                        StateFeatures.FIELDS_PLACEABLE);
                    for(const card of sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards) {
                        card.highlight(false, canSelectCardHighlight);
                    }
                }else {
                    this.addFeatures(StateFeatures.FIELDS_SELECTABLE,
                        StateFeatures.FIELDS_PLACEABLE);
                    let maxLevel = fieldCards.map(field => field.getCard())
                        .filter(card => card !== undefined)
                        .reduce((a,c)=>Math.max(a,c.logicalCard.cardData.level),0)+1;
                    for(const card of sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards) {
                        if(card.logicalCard.cardData.level <= maxLevel || card.logicalCard.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK,
                            {self:card.logicalCard,game:this.game.getGame(), normallyValid:false})) {
                            card.highlight(true, canSelectCardHighlight);
                        }
                    }
                }
            }
            if(handSize >= 5){
                this.features.delete(StateFeatures.DECK_DRAWABLE);
            }else{
                this.features.add(StateFeatures.DECK_DRAWABLE);
            }
        }else{
            this.features.clear();

            for(const card of sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards) {
                card.highlight(card.logicalCard.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK,
                    {self:card.logicalCard,game:this.game.getGame(), normallyValid:false})??false, canSelectCardHighlight);
            }
        }
    }
    swapAway() {
        super.swapAway();

        for(const card of sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards) {
            card.highlight(false, canSelectCardHighlight);
        }
    }

    readonly __isDecrementableInterface=true;
    decrementTurn(toNextTurn=false){
        this.game.getGame().freezableAction(()=>{
            const state = this.game.getGame().state;
            if(state instanceof TurnState) {
                this.game.getGame().setMiscData(GameMiscDataStrings.CAN_PREDRAW, false);
                if(state.decrementAction(true, toNextTurn)){
                    this.game.setState(new VTurnState(other(state.turn), this.game),new TurnState(this.game.getGame(), other(state.turn)));
                }
            }
        });
    }
    getActionsLeft(){
        const state = this.game.getGame().state;
        return state instanceof TurnState ? state.actionsLeft : 0;
    }
    canSelectHandCard(card: VisualCard): boolean {
        if(sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards.length>5) return true;
        const toReturn = card.logicalCard.cardData.level === 1 ||
            sideTernary(this.game.getMySide(), this.game.fieldsA, this.game.fieldsB).some(field =>
                (field.getCard()?.logicalCard.cardData.level ?? 0)+1 >= card.logicalCard.cardData.level);
        if(card.logicalCard.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK,
            {self:card.logicalCard, game:card.game.getGame(), normallyValid:toReturn})??false) return true;
        return toReturn;
    }
}
//todo: i think theres only gonna be 2 cancellable states? (attacking and pick+subclasses) so do we really need this
export interface Cancellable{
    isCancellable():boolean;
    end():void;
}
export const isCancellable = (inst:any) => inst.isCancellable instanceof Function && inst.end instanceof Function;

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
    end(){
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
    public endType;
    public readonly onFinish;
    constructor(game:VisualGame, parentState:[VisualGameState<any>, GameState], cards: VisualCard[], onPick:(card:VisualCard)=>void,
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
    end(){
        this.game.setState(this.parentState[0], this.parentState[1]);
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

const bgPlane = new Mesh(new PlaneGeometry(100,100), new MeshBasicMaterial({color:new Color(0,0,0), opacity:0.5, transparent:true}));
bgPlane.position.set(0,0,-30);
const vGuiButton1 = buttonId();
const vGuiButton2 = buttonId();
const vGuiStates = {
    [Stat.RED]:buttonId(),
    [Stat.BLUE]:buttonId(),
    [Stat.YELLOW]:buttonId(),
}
export class VGuiState extends VisualGameState<TurnState>{
    private parentState: [VisualGameState<any>, GameState];
    private endFunc: (self: VGuiState) => void;
    private initFunc: (self: VGuiState) => void;
    constructor(game:VisualGame, parentState:[VisualGameState<any>, GameState],
            data:{
                onEnd:(self:VGuiState)=>void,
                init:(self:VGuiState)=>void
            }) {
        super(game);
        this.parentState=parentState;
        this.endFunc=data.onEnd;
        this.initFunc = data.init;
    }
    private readonly cardsListeners:number[] = [];
    private readonly cards:VisualCard[]=[];
    addCards(cards:{card:VisualCard, position:Vector2, scale?:number}[], onPick:(card:VisualCard)=>void){
        const newModels:VisualCardClone[] = [];
        this.cardsListeners.push(clickListener(() => {
            const intersects = this.game.raycaster.intersectObjects(newModels
                .map(card=>card.model));
            if (intersects[0] !== undefined) {
                onPick(newModels.find(card=>card.logicalCard.id === (intersects[0]!.object.parent!.parent!.parent! as Group)
                    .userData.card.logicalCard.id)!);
                return true;
            }

            return false;
        }));

        for (let i = 0; i < cards.length; i++) {
            const newCard = new VisualCardClone(cards[i]!.card);
            this.game.addElement(newCard);
            newCard.populate(newCard.logicalCard);
            newCard.createModel().then(()=>{
                camera.add(newCard.model);
            });

            newCard.flipFaceup();
            newCard.position.copy(new Vector3(cards[i]!.position.x, cards[i]!.position.y, -20));
            newCard.rotation = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
            newCard.scale = new Vector3(cards[i]!.scale??1,cards[i]!.scale??1,cards[i]!.scale??1).multiplyScalar(0.05);

            this.cards.push(newCard);
            newModels.push(newCard);
        }

        return this;
    }
    init() {
        super.init();
        this.initFunc(this);
    }

    end() {
        this.endFunc(this);
        this.game.setState(this.parentState[0], this.parentState[1]);
    }

    canSelectHandCard(_card:VisualCard){
        return false;
    }

    button(p5:any, scale:number, onClick:()=>void, text:string, disabled:boolean){
        const width = scale * 1.3;
        const height = scale * 0.4;

        button(p5, p5.width/2-width/2, p5.height - height - scale * 0.1, width, height, text,
            onClick, scale, vGuiButton1, disabled);
    }
    cancelButton(p5:any, scale:number, disabled:boolean){
        this.button(p5, scale, ()=>this.end(), "Cancel", disabled);
    }
    twoButtons(p5:any, scale:number, button1:{onClick:()=>void, text:string, disabled:boolean},
               button2:{onClick:()=>void, text:string, disabled:boolean}){
        const height = scale * 0.4;
        let splitMaybeWidth = scale * 0.8;
        let splitMaybeX = p5.width/2-scale*0.9;

        button(p5, p5.width/2+scale*0.1, p5.height - height - scale * 0.1, splitMaybeWidth, height, button1.text,
            button1.onClick, scale, vGuiButton1, button1.disabled);
        button(p5, splitMaybeX, p5.height - height - scale * 0.1, splitMaybeWidth, height, button2.text,
            button2.onClick, scale, vGuiButton2, button2.disabled);
    }
    buttonAndCancel(p5:any, scale:number, onClick:()=>void, text:string, disabled:boolean, cancelDisabled:boolean){
        this.twoButtons(p5, scale, {onClick, text, disabled},
            {onClick:()=>this.end(), text:"Cancel", disabled:cancelDisabled})
    }
    statButtons(p5:any, scale:number, onClick:(stat:Stat)=>void, shouldHighlight:(stat:Stat)=>boolean, text:(stat:Stat)=>string){
        const height = scale*0.4;
        p5.fill(0);
        for(let i=0;i<3;i++) {
            invisibleButton(p5, scale / 4, p5.height / 2 - height / 2 + (i - 1) * height * 1.3, height, height, () =>
                onClick(i), vGuiStates[i as Stat], (isIn) => {
                const image = assets[{
                    0: "statRed",
                    1: "statBlue",
                    2: "statYellow"
                }[i]! + (isIn || shouldHighlight(i) ? "S" : "")];
                if (image) {
                    p5.image(image, scale / 4, p5.height / 2 - height / 2 + (i - 1) * height * 1.3, height, height);
                    p5.stroke(255);
                    p5.strokeWeight(p5.textSize() / 15);
                    p5.text(text(i),
                        scale / 4 + height / 2, p5.height / 2 - height / 2 + (i - 1) * height * 1.3 + height / 2);
                    p5.noStroke();
                }
            });
        }
    }

    infoText(p5:any, scale:number, text:string){
        p5.image(assets.info, p5.width/2+scale, p5.height - scale*0.6, scale*0.3, scale*0.3);
        currentInfoText=text;
    }

    blackBg(shouldShow:boolean){
        if(shouldShow)
            camera.add(bgPlane);
        else
            bgPlane.removeFromParent();
    }

    swapAway() {
        super.swapAway();
        for(const card of this.cards) card.removeFromGame();
        bgPlane.removeFromParent();
    }
}
let currentInfoText = "";
registerDrawCallback(0, (p5, scale) => {
    if(currentInfoText !== "" && p5.mouseX>p5.width/2+scale && p5.mouseY>p5.height - scale*0.6 &&
        p5.mouseX<p5.width/2+scale*1.3 && p5.mouseY<p5.height - scale*0.3) {
        textBox(p5, scale, currentInfoText);
    }
    currentInfoText="";
})