import Card from "./Card.js";
import {Side} from "./GameElement.js";
import {Event} from "./networking/Events.js";
import {sendEvent} from "./networking/Server.js";
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
    isFirstTurn:boolean,
};

//A logical game
export default class Game{
    public readonly gameID:string;
    public readonly mySide:Side;

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
    };

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
        this.mySide=side||Side.A;
        this.deckA.splice(0,0,...deckA.map(data=> new Card(cards[data.type]!, Side.A, data.id)));
        this.deckB.splice(0,0,...deckB.map(data=> new Card(cards[data.type]!, Side.B, data.id)));
        for(const card of this.deckA) this.cards.add(card);
        for(const card of this.deckB) this.cards.add(card);
    }

    // requestStart(){
    //     for(let i=0; i<this.fieldsA.length; i++) this.fieldsA[i]=undefined;
    //     for(let i=0; i<this.fieldsB.length; i++) this.fieldsB[i]=undefined;
    //     this.runawayA.length=0;
    //     this.runawayB.length=0;
    //
    //     this.currentTurn=CurrentTurn.NEITHER;
    //     this.actionsLeft=0;
    // }
    //
    // startTurn(turn:CurrentTurn.A|CurrentTurn.B){
    //     this.currentTurn=turn;
    //     this.actionsLeft=2;//todo: crisis
    //
    //     const hand = (this.currentTurn == CurrentTurn.A ? this.handA : this.handB);
    //     if(hand.length<5) {
    //         hand.push(
    //             (this.currentTurn == CurrentTurn.A ? this.deckA : this.deckB).pop()!);
    //
    //     }
    // }

    //Sends an event to the client/server
    requestEvent(event:Event<any>){
        sendEvent(event, false);
    }
}
