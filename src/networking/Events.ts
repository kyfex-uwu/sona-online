import IngameCard, {Stat} from "../Card.js";
import {Side} from "../GameElement.js";
import type Game from "../Game.js";
import type {Client} from "./BackendServer.js";
import {network} from "./Server.js";

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

//--

//Tells a card's data and if its faceup
export class ClarifyCardEvent extends Event<{
    id:number,
    cardDataName?:string,
    faceUp?:boolean
}>{}

//(S2C) Rejects a client-side event
export class RejectEvent extends Event<{}>{}
//(S2C) Accepts a client-side event
export class AcceptEvent extends Event<{}>{}

//(C2S) Asks the server to find this client a game
export class FindGameEvent extends Event<{
    deck:Array<string>,
}>{}

//(S2C) Tells the client about the game they've just started
export class GameStartEvent extends Event<{
    deck:Array<{type:string, id:number}>,
    otherDeck:Array<number>,
    which:Side,
}>{}

//(S2C) Tells a watcher about the game they are watching
export class GameStartEventWatcher extends Event<{
    deck:Array<number>,
    otherDeck:Array<number>,
    which:Side,
}>{}

//(C2S) Tells the server if they want to start first or second
export class StartRequestEvent extends Event<{
    which:"first"|"second"|"nopref",
}>{}

//(S2C) Tells the client which side is starting
export class DetermineStarterEvent extends Event<{
    starter:Side,
    flippedCoin:boolean
}>{}

//An event that constitutes an action
export abstract class ActionEvent<T extends {[k:string]:SerializableType}> extends Event<T>{}

//Draws a card. S2C needs side, C2S does not
export class DrawAction extends ActionEvent<{
    side?:Side,
    isAction?:boolean
}>{}

//Places a card in a specific slot
export class PlaceAction extends ActionEvent<{
    cardId:number,
    position:1|2|3,
    side:Side,
    faceUp:boolean,
}>{}

//Attempts to scare a given card. C2S is a request, S2C is a confirmation
export class ScareAction extends ActionEvent<{
    scarerPos:number,
    scaredPos:number,
    attackingWith:Stat,
    failed?:boolean,
    scaredSide:Side,
}>{}

type CardActionOption<T> = {};
export const CardActionOptions = {
    BOTTOM_DRAW: "bottom_draw" as CardActionOption<{side:Side}>
};

//Performs a specific card action
export class CardAction<T extends SerializableType> extends ActionEvent<{
    cardId:number,
    actionName:CardActionOption<T>,
    cardData:T
}>{}

//Discards a card
export class DiscardEvent extends Event<{which:number}>{}

//Passes without doing anything
export class PassAction extends ActionEvent<{}>{}

export class PickCardEvent extends Event<{which:number}>{}

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
export class StringReprSyncEvent extends Event<{str:string}>{}
