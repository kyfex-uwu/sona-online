import Card, {Stat} from "./Card.js";
import type Game from "./Game.js";

let globalID=0;

export class CardActionType<P extends {[k:string]:any}, R>{
    private static nextId=0;
    public readonly id=CardActionType.nextId++;
    private constructor() {}

    public static readonly ACTION = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly LAST_ACTION = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly PLACED = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly AFTER_SCARED = new CardActionType<
        {self:Card, scarer:Card, stat:Stat|"card",game:Game}, void>();
    public static readonly GET_STATS = new CardActionType<
        {self:Card,game:Game}, [number|undefined,number|undefined,number|undefined]>();
    public static readonly INTERRUPT_CRISIS = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly INTERRUPT_SCARE = new CardActionType<
        {self:Card, scared:Card, scarer:Card, stat:Stat|"card",game:Game}, boolean>();//return false to cancel the scare

    public static readonly TURN_START = new CardActionType<
        {self:Card,game:Game}, void>();
    public static readonly IS_FREE = new CardActionType<
        {self:Card,game:Game}, boolean>();
    public static readonly SHOULD_SHOW_HAND = new CardActionType<
        {self:Card,game:Game}, boolean>();
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
    public readonly level:number;
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
                level:number,
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
        switch(stat){
            case Stat.RED: return this.stats[0];
            case Stat.BLUE: return this.stats[1];
            case Stat.YELLOW: return this.stats[2];
        }
    }

    with<P extends { [k: string]: any; }, R>(type:CardActionType<P, R>, value:(params:P)=>R){
        this.cardActions[type.id]=value;
        return this;
    }
    setFree(){
        return this.with(CardActionType.IS_FREE, ()=>true);
    }
    getAction<P extends { [k: string]: any; }, R>(type:CardActionType<P, R>):((params:P)=>R)|undefined{
        return this.cardActions[type.id];
    }
}
