import Card, {type MiscDataString} from "./Card.js";
import {Side} from "./GameElement.js";
import {Event} from "./networking/Events.js";
import {network} from "./networking/Server.js";
import cards from "./Cards.js";
import {BeforeGameState, type GameState} from "./GameStates.js";
import type {Client} from "./networking/BackendServer.js";
import {sideTernary, verifyNoDuplicateStrVals} from "./consts.js";
import type {CardActionOption} from "./networking/CardActionOption.js";

export type GameMiscDataString<T> = {};
//Data that needs to be stored in the game but shouldn't be part of the main properties
export const GameMiscDataStrings = {
    PLAYER_A_STARTREQ: "playerAStartRequest" as GameMiscDataString<"first"|"second"|"nopref">,
    PLAYER_B_STARTREQ: "playerBStartRequest" as GameMiscDataString<"first"|"second"|"nopref">,
    IS_FIRST_TURN:"isFirstTurn" as GameMiscDataString<boolean>,
    CAN_PREDRAW:"canPreDraw" as GameMiscDataString<boolean>,
    FIRST_TURN_AWAITER:"firstTurnAwaiter" as GameMiscDataString<{wait:Promise<void>, resolve:()=>void, waiting:boolean}>,
    NEXT_ACTION_SHOULD_BE: {
        [Side.A]: "AnextActionShould" as GameMiscDataString<CardActionOption<any> | undefined>,
        [Side.B]: "BnextActionShould" as GameMiscDataString<CardActionOption<any> | undefined>,
    },
    CLOUD_CAT_DISABLED:"cloudCatDisabled" as GameMiscDataString<{
        [Side.A]: 1|2|3|"first"|false,
        [Side.B]: 1|2|3|"first"|false
    }>,

    DO_NOT_USE_VALIDATION_ONLY_NASB_A:"AnextActionShould",
    DO_NOT_USE_VALIDATION_ONLY_NASB_B:"BnextActionShould",
};
verifyNoDuplicateStrVals(GameMiscDataStrings, "GameMiscDataStrings has a duplicate");

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

    private miscData: { [k: string]: any } = {};
    public getMiscData<T>(key:GameMiscDataString<T>){ return this.miscData[key as string] as T|undefined; }
    public setMiscData<T>(key:GameMiscDataString<T>, val: T){
        if(val === GameMiscDataStrings.NEXT_ACTION_SHOULD_BE) console.trace("BRO U FUCKED UP")
        this.miscData[key as string]=val;
    }

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

        this.setMiscData(GameMiscDataStrings.IS_FIRST_TURN, true);
        this.setMiscData(GameMiscDataStrings.CAN_PREDRAW, true);
        let resolve=()=>{};
        const wait = new Promise<void>(r=>resolve=r);
        this.setMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER, {wait, resolve, waiting:false});
        this.setMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED, {[Side.A]:false, [Side.B]:false});

        for(const card of this.deckA) this.cards.add(card);
        for(const card of this.deckB) this.cards.add(card);
    }
    public setDeck(side:Side, deck:Array<{type:string, id:number}>){
        sideTernary(side,this.deckA, this.deckB).splice(0,0,...deck.map(data=> new Card(cards[data.type]!, side, this, data.id)));
    }
    public setMySide(side:Side){ this._mySide=side; }

    //Sends an event to the client/server
    requestEvent(event:Event<any>){
        return network.sendToServer(event);
    }
}
