import Card, {Stat} from "./Card.js";
import type Game from "./Game.js";
import {type Event} from "./networking/Events.js";

let globalID=0;

export enum InterruptScareResult{
    PASSTHROUGH,//nothing happens (the scare continues as normal)
    PREVENT_SCARE,//a turn is not consumed and the scare does not happen
    FAIL_SCARE,//a turn is consumed, but the scare does not happen
}

export class CardActionType<P extends {[k:string]:any}, R>{
    private static nextId=0;
    public readonly id=CardActionType.nextId++;
    private constructor() {}

    public static readonly ACTION = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly LAST_ACTION = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly PRE_PLACED = new CardActionType<
        {self:Card, game:Game}, void>();
    public static readonly PLACED = new CardActionType<
        {self:Card,game:Game}, void>();
    //Called once per scare, on the card that was scared
    public static readonly AFTER_SCARED = new CardActionType<
        {self:Card, scarer:Card, stat:Stat|"card",game:Game}, void>();
    public static readonly GET_STATS = new CardActionType<
        {self:Card,game:Game}, [number|undefined,number|undefined,number|undefined]>();
    public static readonly AFTER_CRISIS = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly INTERRUPT_SCARE = new CardActionType<
        //Called while a scare is happening. origEvent can be modified, and next should only be called if PREVENT_SCARE is returned
        {self:Card, scared:Card, scarer:Card, stat:Stat|"card",game:Game, origEvent:Event<any>, next:(succeeded:boolean)=>void}, InterruptScareResult>();
    //Returns true if can be placed
    public static readonly SPECIAL_PLACED_CHECK = new CardActionType<
        {self:Card, game:Game, normallyValid:boolean}, boolean>();
    public static readonly TURN_START = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly IS_FREE = new CardActionType<{}, void>();
    public static readonly IS_SOMETIMES_FREE = new CardActionType<
        {self:Card,game:Game}, boolean>();
    public static readonly SHOULD_SHOW_HAND = new CardActionType<
        {self:Card,game:Game}, boolean>();

    //Only for use on the client
    public static readonly VISUAL_TICK = new CardActionType<{self:Card}, void>();
}

export enum Species{
    CANINE,
    FELINE,
    BAT,
    MUSTELOID,
    LAGOMORPH,
    EQUINE,
    REPTILE,
    AVIAN,
    RODENTIA,
    VULPES,
    AMPHIBIAN,

    UNKNOWN,
}

//The data of a card
export default class CardData{
    public readonly imagePath: string;
    public readonly stats: [number|undefined,number|undefined,number|undefined];
    public readonly id:number;
    public readonly level:1|2|3;
    public readonly name:string;
    public readonly species;

    private cardActions:{ [k:number]:any}={};

    /**
     * Creates a card data
     * @param name The name of the card data (should be the same as its key in {@link cards})
     * @param stats The stats of the card: red, blue, yellow
     * @param level The level of the card
     * @param species The species of the card
     * @param imagePath The image of the card
     */
    constructor(name:string,
                stats:[number|undefined,number|undefined,number|undefined],
                level:1|2|3,
                species:Species,
                imagePath:string=name+".jpg") {
        this.imagePath=imagePath;
        this.stats=stats;
        this.level=level;
        this.id=globalID++;
        this.name=name;
        this.species=species;
    }
    stat(stat:Stat){
        return this.stats[stat];
    }

    with<P extends { [k: string]: any; }, R>(type:CardActionType<P, R>, value:(params:P)=>R){
        this.cardActions[type.id]=value;
        return this;
    }
    setFree(){
        return this.with(CardActionType.IS_FREE, ()=>{});
    }
    //{@link Card.getAction} should be preferred
    getAction<P extends { [k: string]: any; }, R>(type:CardActionType<P, R>):((params:P)=>R)|undefined{
        return this.cardActions[type.id];
    }
    //{@link Card.callAction} should be preferred
    callAction<P extends { [k: string]: any; }, R>(type:CardActionType<P, R>, param:P){
        const action = this.getAction(type);
        if(action !== undefined)
            return action(param);
    }
}
