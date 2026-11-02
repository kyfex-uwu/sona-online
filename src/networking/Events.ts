import type IngameCard from "../Card.js";
import type { CardPos } from "../Card.js";
import type Game from "../Game.js";
import type {Client} from "./backend/BackendServer.js";
import {type CardActionOption, cardActionValidator} from "./CardActionOption.js";
import type CardData from "../CardData.js";
import {enumValues, Side, Stat} from "../consts.js";
import {
    type dataShape,
    SerializableEventNames,
    SerializableEvents,
    SerializableEventShapes,
    ShapeKeywords
} from "./SerializableShapeConsts.js";

function addToSerializableClasses(clazz:{new(...params:any):Event<any>, prototype:{constructor:{name:string}}},
                                  dataShape:dataShape) {
    SerializableEvents[clazz.prototype.constructor.name]=clazz;
    SerializableEventShapes[clazz.prototype.constructor.name]=dataShape;
    SerializableEventNames.add(clazz.prototype.constructor.name);
    return clazz;
}

//Generates an event id
const eventIdGenerator = ()=>new Array(16).fill(0).map(_=>Math.floor(Math.random()*36).toString(36)).join("");
export type SerializableType = string|number|boolean|undefined|{[k:string]:SerializableType}|Array<SerializableType>;
export type SerializableEventData = {[k:string]:SerializableType};

// An event that can be sent to or from the server
export abstract class Event<T extends SerializableEventData>{
    public readonly data:T;
    public sender:Client|undefined;
    public readonly id;

    /**
     * Creates an event
     * @param data The data to send
     * @param game The game (shouldn't need to be filled on client)
     * @param sender Which client sent this event (shouldn't need to be filled on client)
     * @param id The event id (optional, only if you need a reply to this event)
     */
    constructor(data:T, sender?:Client, id?:string) {
        this.data=data;
        this.sender=sender;
        this.id=id||eventIdGenerator();
        this.init();
    }
    //Initializes the event. When this method is called the event already has data, game sender, and id populated
    protected init(){}
    //Serializes this event into a sendable string
    serialize(pretty=false): string {
        return JSON.stringify({
            id:this.id,
            type:this.constructor.name,
            data:this.data
        },null,pretty?2:0);
    }
}

export class InvalidEvent extends Event<{}>{}
addToSerializableClasses(InvalidEvent,{});

export abstract class GameEvent<T extends SerializableEventData> extends Event<T>{}

//--

export enum ClarificationJustification{
    BROWNIE,
    AMBER,
    FURMAKER,
    FURMAKER_VISIBLE,
    YASHI,
    DCW,
    FOXY_MAGICIAN
}
//Tells a card's data and if its faceup
export class C2SClarifyCardEvent extends GameEvent<{
    id: number,
    justification?: ClarificationJustification
}>{}
addToSerializableClasses(C2SClarifyCardEvent,{
    id:"number",
    "justification?":enumValues(ClarificationJustification),
});
export class S2CClarifyCardEvent extends GameEvent<{
    id: number,
    cardDataName: string,
    justification?: ClarificationJustification
}>{}
addToSerializableClasses(S2CClarifyCardEvent,{
    id:"number",
    "cardDataName":"string",
    "justification?":enumValues(ClarificationJustification),
});
export class C2SMultiClarifyCardEvent extends GameEvent<{
    ids:number[],
    justification?: ClarificationJustification
}>{}
addToSerializableClasses(C2SMultiClarifyCardEvent,{
    "justification?":enumValues(ClarificationJustification),
    "ids":"arraynumber",
});
export class S2CMultiClarifyCardEvent extends GameEvent<{
    [id: number]: {cardDataName:string, faceUp:boolean},
    justification?: ClarificationJustification
}>{}
addToSerializableClasses(S2CMultiClarifyCardEvent,{
    "justification?":enumValues(ClarificationJustification),
    [ShapeKeywords.ALL_NUMBERS]:{
        "cardDataName?":"string",
        "faceUp?":"boolean",
    }
});
export function multiClarifyFactory(cards:{id:number,cardData:CardData}[],
                                    justification?:ClarificationJustification){
    return new S2CMultiClarifyCardEvent({
        ...Object.fromEntries(cards
            .map(card => {
                return [card.id, {cardDataName: card.cardData.name}]})),
        ...(justification === undefined?{}:{justification})
    })
}

//Rejects a client-side event
export class S2CRejectEvent extends Event<{}>{}
addToSerializableClasses(S2CRejectEvent,{});
//Accepts a client-side event
export class S2CAcceptEvent extends Event<{}>{}
addToSerializableClasses(S2CAcceptEvent,{});
//Tells the client that the event hasn't been rejected... yet
export class S2CPerchanceEvent extends Event<{}>{}
addToSerializableClasses(S2CPerchanceEvent,{});

//Asks the server to find this client a game
export class C2SFindGameEvent extends Event<{
    deck:Array<string>,
    requestCPU:boolean
}>{}
addToSerializableClasses(C2SFindGameEvent,{
    deck:"arraystring",
    requestCPU:"boolean"
});
//only for use internally
export class S2SInternalStartGameEvent extends GameEvent<{}>{
    public readonly game:Game;
    public readonly p1:Client;
    public readonly p2:Client;
    constructor(game:Game, p1:Client, p2:Client) {
        super({});
        this.game=game;
        this.p1=p1;
        this.p2=p2;
    }
}

//Tells the client about the game they've just started
export class S2CGameStartEvent extends GameEvent<{
    deck:Array<number>,
    otherDeck:Array<number>,
    which:Side,
    cpuGame:boolean
}>{}
addToSerializableClasses(S2CGameStartEvent,{
    deck:"arraynumber",
    otherDeck:"arraynumber",
    which:enumValues(Side),
    cpuGame:"boolean"
});

//Tells the server if they want to start first or second
export class C2SStartRequestEvent extends GameEvent<{
    which:"first"|"second"|"nopref",
}>{}
addToSerializableClasses(C2SStartRequestEvent,{
    which:["first","second","nopref"],
});

//Tells the client which side is starting
export class S2CDetermineStarterEvent extends GameEvent<{
    starter:Side,
    flippedCoin:boolean
}>{}
addToSerializableClasses(S2CDetermineStarterEvent,{
    starter:enumValues(Side),
    flippedCoin:"boolean",
});

//An event that constitutes an action
export abstract class ActionEvent<T extends {[k:string]:SerializableType}> extends GameEvent<T>{
    private forceMarker?:{};
    private freeMarker?:{};
    private game?:Game;
    //Forces the scare through
    force(){
        this.forceMarker = backendMarker;
        return this;
    }
    isForced(){
        return this.forceMarker === backendMarker;
    }
    forceFree(){
        this.freeMarker = backendMarker;
        return this;
    }
    isForcedFree(){
        return this.freeMarker === backendMarker;
    }
    withGame(game:Game){
        this.game=game;
        return this;
    }
    getGame(){
        return this.game;
    }
}

//Draws a card. S2C needs side, C2S does not
export class C2SDrawAction extends ActionEvent<{}>{}
addToSerializableClasses(C2SDrawAction,{});
export class S2CDrawAction extends ActionEvent<{
    side:Side,
    isAction:boolean,
}>{}
addToSerializableClasses(S2CDrawAction,{
    "side":enumValues(Side),
    "isAction":"boolean",
});

//Places a card in a specific slot
export class C2SPlaceAction extends ActionEvent<{
    cardId:number,
    position:1|2|3,
}>{}
addToSerializableClasses(C2SPlaceAction,{
    cardId:"number",
    position:[1,2,3],
});
export class S2CPlaceAction extends ActionEvent<{
    cardId:number,
    position:1|2|3,
    side:Side,
    forFree?:boolean//default false
}>{}
addToSerializableClasses(S2CPlaceAction,{
    cardId:"number",
    position:[1,2,3],
    side:enumValues(Side),
    "forFree?":"boolean"
});

const backendMarker = {};
//Attempts to scare a given card. C2S is a request, S2C is a confirmation. C2S doesnt need failed(?)
export abstract class Abstract2SScareAction<T extends {
    scarerPos:CardPos,
    scaredPos:CardPos,
    attackingWith:Stat|"card",
}> extends ActionEvent<T>{}
export class C2SScareAction extends Abstract2SScareAction<{
    scarerPos:CardPos,
    scaredPos:CardPos,
    attackingWith:Stat,
}>{}
addToSerializableClasses(C2SScareAction,{
    scarerPos:"cardpos",
    scaredPos:"cardpos",
    attackingWith:enumValues(Stat)
});
export class S2CScareAction extends ActionEvent<{
    scarerPos:CardPos,
    scaredPos:CardPos,
    attackingWith:Stat|"card",
    failed:boolean,
    free:boolean,

    extra:{
        shouldRunaway?:boolean
    }
}>{}
addToSerializableClasses(S2CScareAction,{
    scarerPos:"cardpos",
    scaredPos:"cardpos",
    attackingWith:(enumValues(Stat) as (number|string)[]).concat("card"),
    "failed":"boolean",
    "free":"boolean",

    "extra":{
        "shouldRunaway?":"boolean"
    }
});
export class S2SScareAction extends Abstract2SScareAction<{
    scarerPos:CardPos,
    scaredPos:CardPos,
    attackingWith:Stat|"card",

    overrideFailed:boolean|undefined
}>{}

//Performs a specific card action
export class CardAction<T extends SerializableType> extends ActionEvent<{
    actionName:CardActionOption<T>,
    cardData:T,
    side?:Side
}>{}
addToSerializableClasses(CardAction,{
    actionName:"string",
    cardData:cardActionValidator,
});

//Discards a card
export class C2SDiscardAction extends ActionEvent<{id:number}>{}
addToSerializableClasses(C2SDiscardAction,{
    id:"number"
});
export class S2CDiscardAction extends ActionEvent<{id:number, side:Side}>{}
addToSerializableClasses(S2CDiscardAction,{
    id:"number",
    "side":enumValues(Side)
});

//Passes without doing anything
export class PassAction extends ActionEvent<{}>{}
addToSerializableClasses(PassAction,{});

export type Card = {
    id:number,
    cardData?:string,
    faceUp:boolean
}

export class C2SStartTurnAction extends ActionEvent<{}>{}
addToSerializableClasses(C2SStartTurnAction,{});

export class S2CGameWinDefaultEvent extends Event<{}>{}
addToSerializableClasses(S2CGameWinDefaultEvent,{});

/**
 * Transforms a logical card into one that can be sent in an event
 * @param card The logical card
 * @param cardData Whether to send the card data
 * @param faceUp Whether to send if the card is face up or not
 */
export function card(card:IngameCard, {cardData = true, faceUp = true}={}):Card{
    if(card === undefined) return card;
    return {
        id:card.id,
        ...(cardData?{cardData:card.cardData.name}:{}),
        faceUp:faceUp&&card.getFaceUp(),
    };
}

/**
 * Transforms a list of logical cards into a list of cards that can be sent in an event
 * @param cards The logical cards
 * @param cardData Whether to send the cards' data
 * @param faceUp Whether to send if each of the cards are face up or not
 */
export function cardsTransform(cards:Array<IngameCard>, {cardData = true, faceUp = true}={}){
    return cards.map(c => card(c, {cardData, faceUp}));
}

export class C2SRequestServerDumpAction extends ActionEvent<{}>{}
addToSerializableClasses(C2SRequestServerDumpAction,{});
export class S2CServerDumpEvent extends Event<{
    fieldsA:[string|undefined,string|undefined,string|undefined],
    fieldsB:[string|undefined,string|undefined,string|undefined],
    handA:string[],
    handB:string[],
    runawayA:string[],
    runawayB:string[],
    deckA:string[],
    deckB:string[],
    crisises:{A:number, B:number},

    currTurn?:"A"|"B",
    actionsLeft?:number,
}>{}
addToSerializableClasses(S2CServerDumpEvent,{});
