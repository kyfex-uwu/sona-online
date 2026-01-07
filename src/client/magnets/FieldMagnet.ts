import CardMagnet from "./CardMagnet.js";
import {Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import {other, Side} from "../../GameElement.js";
import VisualCard from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {DrawAction, PlaceAction, ScareAction} from "../../networking/Events.js";
import {type Decrementable, isDecrementable, StateFeatures, VAttackingState, VTurnState} from "../VisualGameStates.js";
import {getVictim, Stat} from "../../Card.js";
import {successOrFail} from "../../networking/Server.js";
import {sideTernary} from "../../consts.js";
import {CardActionType} from "../../CardData.js";
import {visualCardClientActions} from "../VisualCardData.js";
import {GameMiscDataStrings} from "../../Game.js";

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

                if(this.game.selectedCard !== undefined &&
                    state.hasFeatures(StateFeatures.FIELDS_PLACEABLE) && this.getSide() === this.game.getMySide() &&
                    state.canSelectHandCard(this.game.selectedCard)){//todo: this is technically a bandaid fix
                    //place card
                    if(this.addCard(this.game.selectedCard)) {
                        const card = this.game.selectedCard;
                        this.game.selectedCard = undefined;
                        card.logicalCard.cardData.callAction(CardActionType.PRE_PLACED,
                            {self:card.logicalCard, game:game.getGame()});
                        if(card.logicalCard.cardData.getAction(CardActionType.PLACED) !== undefined){
                            const action = card.logicalCard.cardData.getAction(CardActionType.PLACED)!;

                            this.storedRunnable = ()=>{
                                action({
                                    self:card.logicalCard,
                                    game:this.game.getGame()
                                });
                            }
                            if(this.started) this.storedRunnable();
                        }
                        // else if(this.game.getGame().getMiscData(GameMiscDataStrings.IS_FIRST_TURN) &&
                        //     this.game.getGame().getMiscData(GameMiscDataStrings.CAN_PREDRAW)){
                        //     this.game.getGame().getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)
                        //         ?.wait.then(()=>{
                        //             if(this.game.state instanceof VTurnState &&
                        //                 this.game.state.currTurn === this.game.getMySide() &&
                        //                 this.game.getGame().getMiscData(GameMiscDataStrings.IS_FIRST_TURN) &&
                        //                 this.game.getGame().getMiscData(GameMiscDataStrings.CAN_PREDRAW))
                        //                 this.game.sendEvent(new DrawAction({}));
                        //     });
                        // }

                        this.game.frozen=true;
                        this.game.sendEvent(new PlaceAction({
                            cardId: card.logicalCard.id,
                            position: this.which,
                            side:this.game.getMySide(),
                            faceUp: (state instanceof VTurnState)
                        })).onReply(successOrFail(()=>{
                            if(isDecrementable(state) &&//deprecated?
                                !(card.logicalCard.cardData.callAction(CardActionType.IS_FREE,
                                    {self:card.logicalCard, game:game.getGame()}) ?? false))// card is not free
                                (state as unknown as Decrementable).decrementTurn();
                        },()=>{
                            card.removeFromHolder();
                            this.game.selectedCard = card;
                        },()=>{
                            this.game.frozen=false;
                        }));

                        return true;
                    }
                }else if(state.hasFeatures(StateFeatures.FIELDS_SELECTABLE) && this.getSide() === this.game.getMySide() ||
                        state.hasFeatures(StateFeatures.ALL_FIELDS_SELECTABLE)){
                    if(state instanceof VTurnState){
                        if(this.card === undefined || this.card.logicalCard.hasAttacked) return false;
                        this.game.setState(new VAttackingState(this.which, this.game), state.getNonVisState());
                        return true;
                    }
                    if(state instanceof VAttackingState &&
                            this.card !== undefined) {
                        if(this.getSide() === this.game.getMySide()) {
                            const intersects = this.game.raycaster.intersectObjects([
                                this.card.getStatModel(Stat.RED),
                                this.card.getStatModel(Stat.BLUE),
                                this.card.getStatModel(Stat.YELLOW),
                                this.card.model
                            ].filter(mesh => mesh !== undefined));

                            if (intersects[0] !== undefined) {
                                if (this.card.logicalCard.cardData.stat(Stat.RED) !== undefined &&
                                        intersects[0].object === this.card.getStatModel(Stat.RED)) {
                                    state.attackData.type = Stat.RED;
                                } else if (this.card.logicalCard.cardData.stat(Stat.BLUE) !== undefined &&
                                        intersects[0].object === this.card.getStatModel(Stat.BLUE)) {
                                    state.attackData.type = Stat.BLUE;
                                } else if (this.card.logicalCard.cardData.stat(Stat.YELLOW) !== undefined &&
                                        intersects[0].object === this.card.getStatModel(Stat.YELLOW)) {
                                    state.attackData.type = Stat.YELLOW;
                                } else if(intersects[0].object.parent?.parent?.parent === this.card.model){
                                    console.log(visualCardClientActions[this.card.logicalCard.cardData.name] !== undefined)
                                    if(visualCardClientActions[this.card.logicalCard.cardData.name] !== undefined){
                                        if(visualCardClientActions[this.card.logicalCard.cardData.name]!(this.card)) {
                                            state.cancel();
                                        }
                                        return true;
                                    }
                                }
                                state.cardIndex=this.which;
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
                                        state.cancel();
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
        return this.card === undefined && this.game.state.hasFeatures(StateFeatures.FIELDS_PLACEABLE) && this.game.getMySide() === this.getSide();
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
