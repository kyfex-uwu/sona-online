import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import {Side} from "../../GameElement.js";
import {DrawAction} from "../../networking/Events.js";
import type VisualGame from "../VisualGame.js";
import VisualCard, {newHighlightLock} from "../VisualCard.js";
import {VTurnState} from "../VisualGameStates.js";
import {successOrFail} from "../../networking/Server.js";
import {externalPromise, shuffled, sideTernary, wait} from "../../consts.js";
import type {CardWithTransform} from "./RunawayMagnet.js";
import {StateFeatures} from "../VisualGameStateTools.js";
import {Animations} from "../ui.js";

export default class DeckMagnet extends CardMagnet{
    private cards:Array<CardWithTransform> = [];
    //Returns a snapshot of the current cards. DOES NOT return the actual data structure, this will not update
    private shuffleData:{
        cards:{
            which:number,
            outPos:Vector3,
            angle:number,
            turns:number,
            time:number,
            k:number,
        }[],
        waiter?:ReturnType<typeof externalPromise<void>>
    }={
        cards:[]
    };
    private shuffling=false;
    public getCards(){ return this.cards.map(data=>data.card);}
    /**
     * Creates a deck magnet
     * @param game the game this is in
     * @param side Which side this element belongs to
     * @param position The position of the card magnet
     * @param props Optional data
     * @param props.rotation The rotation of this magnet
     * @param props.enabled If this magnet is enabled. Default is false
     */
    constructor(game:VisualGame, position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(game, side, position, {
            onClick:()=>{
                if (this.game.state.hasFeatures(StateFeatures.DECK_DRAWABLE) &&
                    this.getSide() === this.game.getMySide() &&
                    this.game.selectedCard === undefined &&
                    sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards.length<5) {
                    this.game.frozen=true;
                    this.game.sendEvent(new DrawAction({})).onReply(successOrFail(()=>{
                        this.drawCard();
                        if(this.game.state instanceof VTurnState) {
                            if (this.game.state.getNonVisState().drawnToStart) {
                                this.game.state.decrementTurn();
                            }
                            this.game.state.getNonVisState().setDrawnToStart();
                        }
                    },undefined,()=>{
                        this.game.frozen=false;
                    }));
                    return true;
                }
                return false;
            },
            ...props,
        });
    }

    addCard(card:VisualCard){
        card.setHolder(this);

        sideTernary(this.getSide(), this.game.getGame().deckA, this.game.getGame().deckB).push(card.logicalCard);

        const rotAmt = Math.random()*0.04-0.02;
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=rotAmt;
        card.flipFacedown();
        this.cards.push({card, rot:rotAmt, pos:new Vector3(Math.random()*2-1,0,Math.random()*2-1)});

        super.addCard(card);
        return true;
    }
    removeCard(card:VisualCard){
        if(this.cards.find(data=>data.card===card) === undefined) return false;
        const deck = sideTernary(this.getSide(), this.game.getGame().deckA, this.game.getGame().deckB);
        deck.splice(deck.indexOf(card.logicalCard),1);

        this.cards.splice(this.cards.findIndex(data=>data.card===card),1);

        return true;
    }
    shouldSnapCards(): boolean {
        return false;
    }

    /**
     * Draws a card and puts it in the player's hand
     */
    drawCard(bottom?:boolean){
        const hand = sideTernary(this.getSide(), this.game.handA, this.game.handB);
        let tempCard = this.cards[this.cards.length - 1]?.card as VisualCard;
        if(bottom) tempCard=this.cards[0]?.card as VisualCard;
        if (tempCard && this.removeCard(tempCard)) {
            tempCard.flipFaceup();
            hand.addCard(tempCard, hand.cards.length);
            return tempCard;
        }
    }

    visualTick() {
        super.visualTick();
        for(let i=0;i<this.cards.length;i++){
            this.cards[i]!.card.rotation = this.rotation.clone().multiply(new Quaternion().setFromEuler(new Euler(0,this.cards[i]!.rot,0)));
            this.cards[i]!.card.position = this.position.clone().add(this.cards[i]!.pos).add(CardMagnet.offs.clone().multiplyScalar(i));
        }
        if(this.shuffling){
            let finished=false;
            for (const data of this.shuffleData.cards) {
                finished=false;

                const card=this.cards[data.which]!.card;
                const k=data.k/data.time;
                if(k<1)
                    card.position = card.position.add(data.outPos.clone().multiplyScalar(1-Math.abs(k-0.5)*2));
                else
                    continue;
                card.rotation = new Quaternion().setFromEuler(new Euler(
                    Math.cos(data.angle)*Math.abs(k*0.1-0.05), data.turns * Math.PI * k, Math.sin(data.angle)*Math.abs(k*0.1-0.05), "YXZ"));

                data.k++;
                if(data.k>=data.time) finished=true;
            }

            if(finished)
                this.shuffleData.waiter!.resolve();
        }
        this.utilityCard.position.copy(this.position);
        this.utilityCard.rotation.copy(this.rotation);
        this.utilityCard.highlight(this.game.state.hasFeatures(StateFeatures.DECK_DRAWABLE) &&
            this.getSide() === this.game.getMySide() &&
            this.game.selectedCard === undefined &&
            sideTernary(this.game.getMySide(), this.game.handA, this.game.handB).cards.length<5,
            highlightLock);
    }

    async shuffle(){
        if(this.shuffling) return;
        this.shuffling=true;

        Animations.run(async ()=> {
            const order = shuffled(new Array(this.cards.length).fill(0).map((_,i)=>i));
            this.shuffleData={
                cards:[],
                waiter:externalPromise(),
            };

            for(let i=0;i<order.length;i++){
                const outDist = 60+Math.random()*30;
                const angle = Math.random()*Math.PI*2;
                this.shuffleData.cards.push({
                    which:order[i]!,
                    outPos: new Vector3(Math.cos(angle)*outDist, 80, Math.sin(angle)*outDist),
                    angle,
                    turns: Math.floor(Math.random()*4+2),
                    time:25+Math.random()*10,
                    k:0,
                });
                await wait(20+Math.random()*20);
            }

            await this.shuffleData.waiter;
            this.shuffling=false;
        });
    }
}
const highlightLock = newHighlightLock();
updateOrder[DeckMagnet.name] = CardMagnet.updateOrder;
