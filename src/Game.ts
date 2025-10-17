import Card from "./Card.js";
import {Side} from "./GameElement.js";
import {Event} from "./networking/Events.js";
import {network} from "./networking/Server.js";
import cards from "./Cards.js";
import {BeforeGameState, type GameState} from "./GameStates.js";
import type {Client} from "./networking/BackendServer.js";
import {sideTernary} from "./consts.js";

//The current game turn
export enum CurrentTurn{
    A,
    B,
    NEITHER,
}
//Data that needs to be stored in the game but shouldn't be part of the main properties
export type MiscData = {
    playerAStartRequest?:"first"|"second"|"nopref",
    playerBStartRequest?:"first"|"second"|"nopref",
    isFirstTurn:boolean,//if this is the first turn of the game (used to prevent first turn attacking)
    canPreDraw:boolean,//if this is the draw happening at the beginning of the first turn
};

//A logical game
export default class Game{
    public readonly gameID:string;
    public _mySide:Side;
    public get mySide(){ return this._mySide; }

    public readonly fieldsA:[Card|undefined,Card|undefined,Card|undefined] =
        [undefined,undefined,undefined];
    public readonly runawayA:Array<Card> = [];
    public readonly deckA:Array<Card> = [];
    public readonly handA:Array<Card> = [];
    public readonly fieldsB:[Card|undefined,Card|undefined,Card|undefined] =
        [undefined,undefined,undefined];
    public readonly runawayB:Array<Card> = [];
    public readonly deckB:Array<Card> = [];
    public readonly handB:Array<Card> = [];

    public readonly cards:Set<Card> = new Set<Card>();

    public _state:GameState = new BeforeGameState(this);
    public get state(){ return this._state; }
    public set state(newState:GameState){
        const oldState = this._state;
        this._state = newState;
        oldState.swapAway();
    }

    public miscData:MiscData={
        isFirstTurn:true,
        canPreDraw:true,
    };
    private _crisises:[number,number]=[0,0];
    public getCrisis(side:Side){
        return this._crisises[side];
    }
    public crisis(side:Side){
        this._crisises[side]++;
    }

    private playerA:Client|undefined=undefined;
    private playerB:Client|undefined=undefined;
    // Sets this game's players to the given players
    public setPlayers(playerA:Client, playerB:Client){
        this.playerA=playerA;
        this.playerB=playerB;
    }
    //@returns the player for that {@link Side}
    public player(which:Side){
        return sideTernary(which, this.playerA, this.playerB);
    }

    public static localID="local";

    /**
     * Creates a game
     * @param deckA Player A's deck
     * @param deckB Player B's deck
     * @param gameID The game ID
     * @param side (CLIENT SIDE ONLY) Which side the local player is on
     */
    public constructor(deckA:Array<{type:string, id:number}>, deckB:Array<{type:string,id:number}>, gameID:string, side?:Side) {
        this.gameID = gameID;
        this._mySide=side||Side.A;
        this.setDeck(Side.A, deckA);
        this.setDeck(Side.B, deckB);
        for(const card of this.deckA) this.cards.add(card);
        for(const card of this.deckB) this.cards.add(card);
    }
    public setDeck(side:Side, deck:Array<{type:string, id:number}>){
        sideTernary(side,this.deckA, this.deckB).splice(0,0,...deck.map(data=> new Card(cards[data.type]!, side, data.id)));
    }
    public setMySide(side:Side){ this._mySide=side; }

    //Sends an event to the client/server
    requestEvent(event:Event<any>){
        return network.sendToServer(event);
    }
}
