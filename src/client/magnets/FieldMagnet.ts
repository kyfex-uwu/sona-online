import CardMagnet from "./CardMagnet.js";
import {Quaternion, Vector3} from "three";
import {cSideTernary, updateOrder} from "../clientConsts.js";
import {Side} from "../../GameElement.js";
import VisualCard from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {PlaceAction, ScareAction} from "../../networking/Events.js";
import {VAttackingState, VTurnState} from "../VisualGameStates.js";
import {Stat} from "../../Card.js";

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
     * @param enabled If this element is enabled
     */
    constructor(position: Vector3, side:Side, which:1|2|3, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(side, position, {
            onClick:game=>{
                const state = game.state;

                if(game.selectedCard !== undefined){
                    if(state instanceof VTurnState && state.getActionsLeft()<=0) return false;

                    if(this.addCard(game, game.selectedCard)) {
                        game.sendEvent(new PlaceAction({
                            cardId: game.selectedCard.card.id,
                            position: this.which,
                            side:game.getMySide(),
                            faceUp: (state instanceof VTurnState)
                        }));
                        game.selectedCard = undefined;

                        // if(state instanceof VTurnState)
                        //     state.decrementTurn();
                        return true;
                    }
                }else{
                    if(state instanceof VTurnState){
                        if(this.card === undefined) return false;
                        game.setState(new VAttackingState(this.card, game), state.getNonVisState());
                        return true;
                    }
                    if(state instanceof VAttackingState &&
                            this.card !== undefined) {
                        if(this.getSide() === game.getMySide()) {
                            const intersects = game.raycaster.intersectObjects([
                                this.card.getStatModel(Stat.RED),
                                this.card.getStatModel(Stat.BLUE),
                                this.card.getStatModel(Stat.YELLOW),
                                this.card.model
                            ].filter(mesh => mesh !== undefined));

                            if (intersects[0] !== undefined) {
                                if (intersects[0].object === this.card.getStatModel(Stat.RED)) {
                                    state.attackData.type = "red";
                                } else if (intersects[0].object === this.card.getStatModel(Stat.BLUE)) {
                                    state.attackData.type = "blue";
                                } else if (intersects[0].object === this.card.getStatModel(Stat.YELLOW)) {
                                    state.attackData.type = "yellow";
                                } else {
                                    state.attackData.type = "card";
                                }
                            }
                        }else{
                            if(state.attackData.type !== undefined) {
                                const intersects = game.raycaster.intersectObjects([
                                    this.card.model
                                ].filter(mesh => mesh !== undefined));
                                if (intersects[0] !== undefined) {
                                    if (state.attackData.type !== "card") {
                                        game.sendEvent(new ScareAction({
                                            scaredId: this.card.card.id,
                                            scarerId: state.card.card.id,
                                            attackingWith: {
                                                red: Stat.RED,
                                                blue: Stat.BLUE,
                                                yellow: Stat.YELLOW,
                                            }[state.attackData.type]
                                        }));
                                    }
                                    state.returnToParent();
                                }
                            }
                        }
                        return true;
                    }

                    let tempCard = this.card;
                    if(this.removeCard(game)) {
                        game.selectedCard = tempCard;
                        return true;
                    }
                }

                return false;
            },
            ...props,
        });
        this.which=which;
    }

    addCard(game:VisualGame, card:VisualCard){
        if(this.card !== undefined) return false;
        this.card = card;
        cSideTernary(game, game.getGame().fieldsA, game.getGame().fieldsB)[this.which-1] = card.card;
        this.card!.position.copy(this.position);
        this.card!.rotation.copy(this.rotation);
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(game, card);
        return true;
    }
    removeCard(game:VisualGame){
        if(this.card === undefined) return false;
        cSideTernary(game, game.getGame().fieldsA, game.getGame().fieldsB)[this.which-1] = undefined;
        this.unchildCard(game, this.card);
        this.position.sub(CardMagnet.offs);

        return true;
    }
    unchildCard(game:VisualGame, card:VisualCard){
        this.card = undefined;
    }
}
updateOrder[FieldMagnet.name] = CardMagnet.updateOrder;
