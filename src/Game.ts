import Card from "./Card.js";
import {Side} from "./GameElement.js";
import {Event} from "./networking/Events.js";
import {sendEvent} from "./networking/Server.js";
import cards from "./Cards.js";
import {BeforeGameState, type GameState} from "./GameStates.js";

export enum CurrentTurn{
    A,
    B,
    NEITHER,
}

export default class Game{
    public readonly gameID:string;
    public readonly side:Side;

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

    public readonly cards:Array<Card> = [];

    private state:GameState = new BeforeGameState();

    public currentTurn:CurrentTurn = CurrentTurn.NEITHER;
    public actionsLeft = 0;
    public processingAction = false;

    public static localID="local";
    public constructor(yourDeck:Array<{type:string, id:number}>, theirDeck:Array<{type:string,id:number}>, gameID:string, side?:Side) {
        this.gameID = gameID;
        this.side=side||Side.A;
        this.deckA.splice(0,0,...yourDeck.map(data=> new Card(cards[data.type]!, Side.A, data.id)));
        this.deckB.splice(0,0,...theirDeck.map(data=> new Card(cards[data.type]!, Side.B, data.id)));
        this.cards.splice(0,0,...this.deckA);
        this.cards.splice(0,0,...this.deckB);
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

    requestEvent(event:Event<any>){
        this.processingAction = true;
        sendEvent(event, false);
    }

    logicTick(){
        this.state.tick(this);
    }
}
