import CardMagnet from "./CardMagnet.js";
import {Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import {other, Side} from "../../GameElement.js";
import VisualCard, {newHighlightLock} from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {PlaceAction, ScareAction} from "../../networking/Events.js";
import {
    canSelectCardHighlight,
    type Decrementable,
    isDecrementable,
    StateFeatures,
    VAttackingState,
    VTurnState
} from "../VisualGameStates.js";
import {CardMiscDataStrings, getVictim, Stat} from "../../Card.js";
import {successOrFail} from "../../networking/Server.js";
import {sideTernary} from "../../consts.js";
import {CardTriggerType} from "../../CardData.js";
import {visualCardClientActions} from "../VisualCardData.js";
import {GameMiscDataStrings} from "../../Game.js";

const attackLock = newHighlightLock();
export default class FieldMagnet extends CardMagnet{
    private card:VisualCard|undefined;
    public readonly which:1|2|3;
    public getCard(){ return this.card; }

    /**
     * Creates a field magnet
     * @param position The position of this element
     * @param side The side of this element
     * @param which Which field this element is
     * @param props Optional data
     * @param rotation The rotation of this element
     */
    constructor(game:VisualGame, position: Vector3, side:Side, which:1|2|3, props:{rotation?:Quaternion}={}) {
        super(game, side, position, {
            onClick:()=>{
                const state = this.game.state;

                if(this.game.selectedCard !== undefined && this.getSide() === this.game.getMySide() &&
                    state.canSelectHandCard(this.game.selectedCard) &&
                    (state.hasFeatures(StateFeatures.FIELDS_PLACEABLE)||
                        this.game.selectedCard.logicalCard.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK,
                            {self:this.game.selectedCard.logicalCard, game:this.game.getGame(), normallyValid:false}))){
                    if(this.addCard(this.game.selectedCard)) {
                        const card = this.game.selectedCard;
                        card.highlight(false, canSelectCardHighlight);
                        this.game.selectedCard = undefined;

                        this.game.frozen=true;
                        this.game.sendEvent(new PlaceAction({
                            cardId: card.logicalCard.id,
                            position: this.which,
                            side:this.game.getMySide(),
                            faceUp: (state instanceof VTurnState)
                        })).onReply(successOrFail(()=>{
                            if(isDecrementable(state) &&//deprecated?
                                (!card.logicalCard.isAlwaysFree() && !card.logicalCard.isFreeNow()))
                                (state as unknown as Decrementable).decrementTurn();
                        },()=>{
                            card.removeFromHolder();
                            this.game.selectedCard = card;
                        },()=>{
                            this.game.frozen=false;
                        }));

                        card.logicalCard.callAction(CardTriggerType.PRE_PLACED,
                            {self:card.logicalCard, game:game.getGame()});
                        if(card.logicalCard.getAction(CardTriggerType.PLACED) !== undefined){
                            const action = card.logicalCard.getAction(CardTriggerType.PLACED)!;

                            this.storedRunnable = ()=>{
                                action({
                                    self:card.logicalCard,
                                    game:this.game.getGame()
                                });
                            }
                            if(this.started) this.storedRunnable();
                        }

                        return true;
                    }
                }else if(state.hasFeatures(StateFeatures.FIELDS_SELECTABLE) && this.getSide() === this.game.getMySide() ||
                        state.hasFeatures(StateFeatures.ALL_FIELDS_SELECTABLE)){
                    if(state instanceof VTurnState){
                        if(this.card === undefined || (
                            this.card.logicalCard.hasAttacked &&
                            (this.card.logicalCard.getAction(CardTriggerType.ACTION) != null &&
                                !this.card.logicalCard.getMiscData(CardMiscDataStrings.ALREADY_ACTIONED)))) return false;
                        this.game.setState(new VAttackingState(this.which, this.game), state.getNonVisState());
                        return true;
                    }
                    if(state instanceof VAttackingState &&
                            this.card !== undefined) {
                        if(this.getSide() === this.game.getMySide()) {
                            const intersects = this.game.raycaster.intersectObjects([
                                ...(this.card.logicalCard.hasAttacked?[]:[this.card.getStatModel(Stat.RED),
                                this.card.getStatModel(Stat.BLUE),
                                this.card.getStatModel(Stat.YELLOW)]),
                                this.card.model
                            ].filter(mesh => mesh !== undefined));

                            if (intersects[0] !== undefined) {
                                sideTernary(this.getSide(), game.fieldsA, game.fieldsB)[state.cardIndex-1]!.getCard()
                                    ?.highlightStat({[Stat.RED]:false, [Stat.BLUE]:false, [Stat.YELLOW]:false}, attackLock);
                                state.cardIndex=this.which;
                                const cardClicked = sideTernary(this.getSide(), game.fieldsA, game.fieldsB)[state.cardIndex-1]!.getCard();

                                let hitStat=false;
                                for(const stat of [Stat.RED, Stat.BLUE, Stat.YELLOW]){
                                    if (this.card.logicalCard.stat(stat) !== undefined &&
                                        intersects[0].object === this.card.getStatModel(stat)) {
                                        state.attackData.type = stat;
                                        cardClicked?.highlightStat({[stat]:true}, attackLock);
                                        hitStat=true;
                                        break;
                                    }
                                }
                                if(!hitStat && intersects[0].object.parent?.parent?.parent === this.card.model){
                                    if(visualCardClientActions[this.card.logicalCard.cardData.name] !== undefined){
                                        visualCardClientActions[this.card.logicalCard.cardData.name]!(this.card).then((cancel)=>{
                                            if(cancel) state.end();
                                        });
                                        return true;
                                    }
                                }
                            }
                        }else{
                            if(state.attackData.type !== undefined) {
                                const intersects = this.game.raycaster.intersectObjects([
                                    this.card.model
                                ].filter(mesh => mesh !== undefined));
                                if (intersects[0] !== undefined) {
                                    if (getVictim(state.attackData.type) !== undefined &&
                                        !this.card.logicalCard.hasAttacked &&
                                        !this.game.getGame().getMiscData(GameMiscDataStrings.IS_FIRST_TURN)) {
                                        this.game.sendEvent(new ScareAction({
                                            scaredPos: [this.which, other(this.game.getMySide())],
                                            scarerPos: [state.cardIndex, this.game.getMySide()],
                                            attackingWith: state.attackData.type,
                                        }));
                                        this.game.frozen=true;
                                        state.end();
                                        return true;
                                    }
                                }
                            }
                        }
                        return true;
                    }

                    // let tempCard = this.card;
                    // if(this.removeCard(game)) {
                    //     game.selectedCard = tempCard;
                    //     return true;
                    // }
                }

                return false;
            },
            ...props,
        });
        this.which=which;
    }

    addCard(card:VisualCard){
        if(this.card !== undefined) return false;
        this.card = card;
        sideTernary(this.getSide(), this.game.getGame().fieldsA, this.game.getGame().fieldsB)[this.which-1] = card.logicalCard;
        this.card!.position.copy(this.position);
        this.card!.rotation.copy(this.rotation);
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(card);
        return true;
    }
    removeCard(){
        if(this.card === undefined) return false;
        sideTernary(this.getSide(), this.game.getGame().fieldsA, this.game.getGame().fieldsB)[this.which-1] = undefined;
        this.card = undefined;
        this.position.sub(CardMagnet.offs);

        return true;
    }
    shouldSnapCards(): boolean {
        return this.card === undefined &&
            (this.game.state.hasFeatures(StateFeatures.FIELDS_PLACEABLE) ||
                (this.game.selectedCard?.logicalCard.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK,
                    {self:this.game.selectedCard.logicalCard,
                        game:this.game.selectedCard.game.getGame(),
                    normallyValid:false})??false)) &&
            this.game.getMySide() === this.getSide();
    }

    visualTick() {
        super.visualTick();
        if(this.card !== undefined){
            this.card.rotation = this.rotation.clone();//bruh
        }
        // this.utilityCard.highlight(this.game.state.hasFeatures(StateFeatures.FIELDS_PLACEABLE) && this.getSide() === this.game.getMySide());
    }

    private started=false;
    private storedRunnable?:()=>void;
    startGame(){
        this.started=true;
        if(this.storedRunnable) this.storedRunnable();
    }
}
updateOrder[FieldMagnet.name] = CardMagnet.updateOrder;
