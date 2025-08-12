import Card from "./Card.js";
import {Side} from "./GameElement.js";
import {shuffled} from "./consts.js";
import {Event} from "./networking/Events.js";
import {sendEvent} from "./networking/Server.js";
import cards from "./Cards.js";

export enum CurrentTurn{
    YOURS,
    THEIRS,
    NEITHER,
}

export default class Game{
    public readonly gameID:string;
    public readonly side:Side;

    public readonly yourFields:[Card|undefined,Card|undefined,Card|undefined] =
        [undefined,undefined,undefined];
    public readonly yourRunaway:Array<Card> = [];
    public readonly yourDeck:Array<Card> = [];
    public readonly yourHand:Array<Card> = [];
    public readonly theirFields:[Card|undefined,Card|undefined,Card|undefined] =
        [undefined,undefined,undefined];
    public readonly theirRunaway:Array<Card> = [];
    public readonly theirDeck:Array<Card> = [];
    public readonly theirHand:Array<Card> = [];

    public currentTurn:CurrentTurn = CurrentTurn.NEITHER;
    public actionsLeft = 0;
    public processingAction = false;

    public static localID="local";
    public constructor(yourDeck:Array<string>, theirDeck:Array<string>, gameID:string, side?:Side) {
        this.gameID = gameID;
        this.side=side||Side.YOU;
        let id=0;
        this.yourDeck.splice(0,0,...shuffled(yourDeck).map(name=> new Card(cards[name]!, Side.YOU, id++)));
        this.theirDeck.splice(0,0,...shuffled(theirDeck).map(name=> new Card(cards[name]!, Side.THEM, id++)));
    }

    requestStart(){
        for(let i=0;i<this.yourFields.length;i++) this.yourFields[i]=undefined;
        for(let i=0;i<this.theirFields.length;i++) this.theirFields[i]=undefined;
        this.yourRunaway.length=0;
        this.theirRunaway.length=0;

        this.currentTurn=CurrentTurn.NEITHER;
        this.actionsLeft=0;
    }

    startTurn(turn:CurrentTurn.YOURS|CurrentTurn.THEIRS){
        this.currentTurn=turn;
        this.actionsLeft=2;//todo: crisis

        const hand = (this.currentTurn == CurrentTurn.YOURS ? this.yourHand : this.theirHand);
        if(hand.length<5) {
            hand.push(
                (this.currentTurn == CurrentTurn.YOURS ? this.yourDeck : this.theirDeck).pop()!);

        }
    }

    requestEvent(event:Event<any>){
        this.processingAction = true;
        sendEvent(event, false);
    }
}
