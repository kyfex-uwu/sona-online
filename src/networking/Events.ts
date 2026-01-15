import IngameCard, {Stat} from "../Card.js";
import {Side} from "../GameElement.js";
import type Game from "../Game.js";
import type {Client} from "./BackendServer.js";
import {network} from "./Server.js";
import {type CardActionOption} from "./CardActionOption.js";
import type CardData from "../CardData.js";

export const SerializableClasses:{[k:string]:{new():Event<any>}} = {};
function addToSerializableClasses(clazz:{new(...params:any):Event<any>, prototype:{constructor:{name:string}}}) {
    SerializableClasses[clazz.prototype.constructor.name]=clazz;
    return clazz;
}

//Generates an event id
const eventIdGenerator = ()=>new Array(16).fill(0).map(_=>Math.floor(Math.random()*36).toString(36)).join("");
export type SerializableType = string|number|boolean|undefined|{[k:string]:SerializableType}|Array<SerializableType>;
export type SerializableEventData = {[k:string]:SerializableType};

// An event that can be sent to or from the server
export abstract class Event<T extends SerializableEventData>{
    public readonly data:T;
    public readonly game:Game|undefined;
    public readonly sender:Client|undefined;
    public readonly id;

    /**
     * Creates an event
     * @param data The data to send
     * @param game The game (shouldn't need to be filled on client)
     * @param sender Which client sent this event (shouldn't need to be filled on client)
     * @param id The event id (optional, only if you need a reply to this event)
     */
    constructor(data:T, game?:Game, sender?:Client, id?:string) {
        this.data=data;
        this.game=game||network.clientGame;
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
addToSerializableClasses(InvalidEvent);

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
export class ClarifyCardEvent extends Event<{
    id: number,
    cardDataName?: string,
    faceUp?: boolean,
    justification?: ClarificationJustification
}>{}
addToSerializableClasses(ClarifyCardEvent);
export class MultiClarifyCardEvent extends Event<{
    [id: number]: {cardDataName?:string, faceUp?:boolean},
    justification?: ClarificationJustification
}>{}
addToSerializableClasses(MultiClarifyCardEvent);
export function multiClarifyFactory(cards:{id:number,cardData:CardData}[],
                                    justification?:ClarificationJustification){
    return new MultiClarifyCardEvent({
        ...Object.fromEntries(cards
            .map(card => {
                return [card.id, {cardDataName: card.cardData.name}]})),
        ...(justification === undefined?{}:{justification})
    })
}

//(S2C) Rejects a client-side event
export class RejectEvent extends Event<{}>{}
addToSerializableClasses(RejectEvent);
//(S2C) Accepts a client-side event
export class AcceptEvent extends Event<{}>{}
addToSerializableClasses(AcceptEvent);

//(C2S) Asks the server to find this client a game
export class FindGameEvent extends Event<{
    deck:Array<string>,
}>{}
addToSerializableClasses(FindGameEvent);

//(S2C) Tells the client about the game they've just started
export class GameStartEvent extends Event<{
    deck:Array<number>,
    otherDeck:Array<number>,
    which:Side,
}>{}
addToSerializableClasses(GameStartEvent);

//(S2C) Tells a watcher about the game they are watching
export class GameStartEventWatcher extends Event<{
    deck:Array<number>,
    otherDeck:Array<number>,
    which:Side,
}>{}
addToSerializableClasses(GameStartEventWatcher);

//(C2S) Tells the server if they want to start first or second
export class StartRequestEvent extends Event<{
    which:"first"|"second"|"nopref",
}>{}
addToSerializableClasses(StartRequestEvent);

//(S2C) Tells the client which side is starting
export class DetermineStarterEvent extends Event<{
    starter:Side,
    flippedCoin:boolean
}>{}
addToSerializableClasses(DetermineStarterEvent);

//An event that constitutes an action
export abstract class ActionEvent<T extends {[k:string]:SerializableType}> extends Event<T>{}

//Draws a card. S2C needs side, C2S does not
export class DrawAction extends ActionEvent<{
    side?:Side,
    isAction?:boolean,//default true
}>{}
addToSerializableClasses(DrawAction);

//Places a card in a specific slot
export class PlaceAction extends ActionEvent<{
    cardId:number,
    position:1|2|3,
    side:Side,
    faceUp:boolean,
    forFree?:boolean//default false
}>{
    private forceMarker?:{};
    //Forces the scare through
    force(){
        this.forceMarker = backendMarker;
        return this;
    }
    isForced(){
        return this.forceMarker === backendMarker;
    }
}
addToSerializableClasses(PlaceAction);

const backendMarker = {};
//Attempts to scare a given card. C2S is a request, S2C is a confirmation. C2S doesnt need failed(?)
export class ScareAction extends ActionEvent<{
    scarerPos:[1|2|3, Side],
    scaredPos:[1|2|3, Side],
    attackingWith:Stat|"card",
    failed?:boolean,
    free?:boolean,
}>{
    private forceMarker?:{};
    private freeMarker?:{};
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
}
addToSerializableClasses(ScareAction);
// export const internalCardScareMarker={};
// export class InternalCardScareAction extends ScareAction{
//     public readonly valid;
//     constructor(params:{
//         scarerPos:1|2|3,
//         scaredPos:1|2|3,
//         failed?:boolean,
//         scaredSide:Side,
//     }, marker:{}) {
//         super({
//             ...params,
//             attackingWith:Stat.RED,
//         });
//         this.valid=marker===internalCardScareMarker;
//     }
// }

//Performs a specific card action
export class CardAction<T extends SerializableType> extends ActionEvent<{
    cardId:number,
    actionName:CardActionOption<T>,
    cardData:T
}>{}
addToSerializableClasses(CardAction);

//Discards a card
export class DiscardEvent extends Event<{which:number}>{}
addToSerializableClasses(DiscardEvent);

//Passes without doing anything
export class PassAction extends ActionEvent<{}>{}
addToSerializableClasses(PassAction);

export type Card = {
    id:number,
    cardData?:string,
    faceUp:boolean
}

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

//(C2S) A debug event that sends the entire game state as the backend knows it
export class RequestSyncEvent extends Event<{}>{}
addToSerializableClasses(RequestSyncEvent);
//(S2C) A debug event that sends all the data of the game
export class SyncEvent extends Event<{
    fieldsA:[Card|undefined, Card|undefined, Card|undefined],
    fieldsB:[Card|undefined, Card|undefined, Card|undefined],
    deckA:Array<Card>,
    deckB:Array<Card>,
    handA:Array<Card>,
    handB:Array<Card>,
    runawayA:Array<Card>,
    runawayB:Array<Card>
}>{}
addToSerializableClasses(SyncEvent);
export class StringReprSyncEvent extends Event<{str:string}>{}
addToSerializableClasses(StringReprSyncEvent);
