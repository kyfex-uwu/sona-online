import Card, {type CardTemplate} from "./Card.js";
import {type GameElement, Side} from "./GameElement.js";
import {shuffled} from "./consts.js";
import {Event, FindGameEvent} from "./networking/Events.js";
import {sendEvent} from "./networking/Server.js";

export enum ViewType{
    WHOLE_BOARD,
    FIELDS,
}
export enum CurrentTurn{
    YOURS,
    THEIRS,
    NEITHER,
}

export default class Game{

    public selectedCard:Card|undefined;
    public readonly elements:GameElement[] = [];

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

    public constructor() {
    }

    requestStart(){
        for(let i=0;i<this.yourFields.length;i++) this.yourFields[i]=undefined;
        for(let i=0;i<this.theirFields.length;i++) this.theirFields[i]=undefined;
        this.yourDeck.length=0;
        this.theirDeck.length=0;
        this.yourRunaway.length=0;
        this.theirRunaway.length=0;

        this.currentTurn=CurrentTurn.NEITHER;
        this.actionsLeft=0;

        this.requestEvent(new FindGameEvent({}));
    }
    load(yourDeck:CardTemplate[], theirDeck:CardTemplate[]){
        this.yourDeck.splice(0,0,...shuffled(yourDeck).map(template=>template(Side.YOU)))
        this.theirDeck.splice(0,0,...shuffled(theirDeck).map(template=>template(Side.THEM)))
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
