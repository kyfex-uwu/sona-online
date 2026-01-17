import {type GameElement, Side} from "./GameElement.js";
import CardData, {CardTriggerType} from "./CardData.js";
import {sideTernary, verifyNoDuplicateStrVals} from "./consts.js";
import Game, {GameMiscDataStrings} from "./Game.js";
import {addTempStats} from "./Cards.js";
import type {ScareAction} from "./networking/Events.js";

//Which stat on a card
export enum Stat{
    RED=0,
    BLUE=1,
    YELLOW=2
}
export function getVictim(stat:Stat){
    switch(stat){
        case Stat.RED: return Stat.YELLOW;
        case Stat.BLUE: return Stat.RED;
        case Stat.YELLOW: return Stat.BLUE;
    }
}
export function getAttacker(stat:Stat){
    switch(stat){
        case Stat.RED: return Stat.BLUE;
        case Stat.BLUE: return Stat.YELLOW;
        case Stat.YELLOW: return Stat.RED;
    }
}

export type CardMiscDataString<T> = {};
export const CardMiscDataStrings = {
    TRASH_PANDA_IMMUNITY: "og-011_immunity" as CardMiscDataString<"wait"|"immune"|"not immune">,
    LITTLEBOSS_IMMUNE: "og-015_immunity" as CardMiscDataString<boolean>,
    K9_TEMP_STAT_UPGRADE: "og-001_statupgrade" as CardMiscDataString<{ stat: Stat, newVal: number }>,
    CLOUD_CAT_ALREADY_PICKED: "og-043_alreadypicked" as CardMiscDataString<boolean>,
    COWGIRL_COYOTE_TARGET: "og-035_target" as CardMiscDataString<Card>,
    BROY_WEASLA_TARGET: "og-029_target" as CardMiscDataString<Card>,
    FURMAKER_ALREADY_ASKED_FOR: "og-041_alreadyaskedfor" as CardMiscDataString<Set<number>>,
    NOBLE_ORIG_SCARE:" og-020_origscare" as CardMiscDataString<ScareAction>,

    PAUSED_SCARE:"pausedScare" as CardMiscDataString<() => void>,
    ALREADY_ATTACKED:"alreadyAttacked" as CardMiscDataString<boolean>,
    TEMP_STAT_UPGRADES: "tempStatUpgrades" as CardMiscDataString<{ [source: string]: [number, number, number] }>
};
verifyNoDuplicateStrVals(CardMiscDataStrings, "MiscDataStrings has a duplicate");

//A *logical* card
export default class Card implements GameElement{
    private _cardData:CardData;
    public get cardData(){ return this._cardData; }
    public readonly side:Side;
    private _id:number;
    public get id(){ return this._id; }
    private readonly game:Game;

    private miscData: { [k: string]: any } = {};
    public getMiscData<T>(key:CardMiscDataString<T>){ return this.miscData[key as string] as T|undefined; }
    public setMiscData<T>(key:CardMiscDataString<T>, val: T){ this.miscData[key as string]=val; }
    public hasAttacked=false;

    /**
     * Creates a logical card
     * @param cardData The card data
     * @param side Which side the card belongs to
     * @param game The game this card belongs to
     * @param id The id of the card (should be unique per game)
     */
    constructor(cardData: CardData, side:Side, game:Game, id:number) {
        this._cardData=cardData;
        this.side=side;
        this.game=game;
        this._id=id;

        this.setMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES, {});
    }

    private faceUp = true;
    //Flips the logical card facedown
    flipFacedown(){
        this.faceUp=false;
    }
    //Flips the logical card faceup
    flipFaceup(){
        this.faceUp=true;
    }
    //Returns this card's side
    getSide(){ return this.side; }
    //Returns if this card is face up
    getFaceUp(){ return this.faceUp; }

    getGame() { return this.game; }

    private disabled(){
        const disabledLoc = this.game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![this.side];
        if(disabledLoc !== false) {
            const fieldLoc = sideTernary(this.side, this.game.fieldsA, this.game.fieldsB)
                .indexOf(this);
            if (fieldLoc !== -1 && (disabledLoc === "first" || disabledLoc - 1 === fieldLoc)) return true;
        }
        return false;
    }
    getAction<P extends { [k: string]: any; }, R>(type:CardTriggerType<P, R>):((params:P)=>R)|undefined{
        return this.disabled() ? undefined : this.cardData.getAction(type);
    }
    callAction<P extends { [k: string]: any; }, R>(type:CardTriggerType<P, R>, param:P){
        return this.disabled() ? undefined : this.cardData.callAction(type, param);
    }
    stat(stat:Stat){
        return (this.callAction(CardTriggerType.GET_STATS, {self:this,game:this.game}) ??
            addTempStats(this, [...this.cardData.stats]))[stat];
    }

    //USE WITH EXTREME CAUTION
    setCardData(data:CardData){
        this._cardData=data;
    }
    //USE WITH EXTREME CAUTION
    setId(id:number){
        this._id=id;
    }

    //@return if this card is free by way of having "Can be placed for Free" text
    isAlwaysFree(){
        return this.getAction(CardTriggerType.IS_FREE) !== undefined;
    }
    //@return if this card should decrement the turn when placed
    isFreeNow(){
        return this.callAction(CardTriggerType.IS_SOMETIMES_FREE, {self:this, game:this.game})??false;
    }
}
