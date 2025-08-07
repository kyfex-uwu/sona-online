import Card, {CardColor, type CardTemplate} from "../Card.js";
import Game, {CurrentTurn} from "../Game.js";
import {Side} from "../GameElement.js";
import cards from "../Cards.js";
import {sendEvent} from "./Server.js";

//todo: stuff
const eventIdGenerator = ()=>Math.random();

abstract class Event{
    public readonly type:string;
    protected constructor(type:string) {
        this.type=type;
    }
}
export abstract class ServerEvent extends Event{
    apply(game:Game):void{
        game.processingAction=false;
    }
}//an event the server sends
type SerializableType = string|number|boolean|undefined|{[k:string]:SerializableType}|Array<SerializableType>;
export abstract class ClientEvent extends Event{
    private readonly id = eventIdGenerator();
    abstract serialize():SerializableType;
}//an event the client sends
export class AcceptedEventEvent extends ServerEvent{
    public readonly eventId:number
    public readonly accepted:boolean;
    constructor(id:number, accepted:boolean) {
        super("AcceptedEvent");
        this.eventId=id;
        this.accepted=accepted;
    }
}

type SerializableCard = {id:number, name:string};

export class FindGameEvent extends ClientEvent{
    constructor() {
        super("FindGame");
    }
    serialize(): SerializableType {
        return undefined;
    }
}
export class GameStartEvent extends ServerEvent{
    public readonly yourDeck:Array<CardTemplate>;
    public readonly theirDeck:Array<CardTemplate>;
    constructor(yourDeck:Array<SerializableCard>, theirDeck:Array<SerializableCard>) {
        super("GameStart");
        this.yourDeck = yourDeck.map(data => cards[data.name]!(data.id));
        this.theirDeck = theirDeck.map(data => cards[data.name]!(data.id));
    }

    apply(game: Game) {
        game.load(this.yourDeck, this.theirDeck);
        game.sendEvent(new StartRequestEvent(Side.YOU));
        super.apply(game);
    }
}
export class StartRequestEvent extends ClientEvent{
    public readonly startRequest?:Side;
    constructor(startRequest:Side) {
        super("StartRequest");
        this.startRequest = startRequest;
    }
    serialize(){
        switch(this.startRequest){
            case Side.YOU: return 1;
            case Side.THEM: return 2;
        }
        return 0;//if the user doesnt care
    }
}
export class DetermineStarterEvent extends ServerEvent{
    public readonly starter:Side;
    public readonly flippedCoin:boolean;
    constructor(starter:Side, flippedCoin:boolean) {
        super("DetermineStarter");
        this.starter=starter;
        this.flippedCoin=flippedCoin;
    }
    apply(game: Game) {
        if(!this.flippedCoin){
            game.startTurn(this.starter === Side.YOU ? CurrentTurn.YOURS : CurrentTurn.THEIRS);
        }else{
            //flip a coin, each side has a player's name on it?
            game.startTurn(this.starter === Side.YOU ? CurrentTurn.YOURS : CurrentTurn.THEIRS);
        }
        super.apply(game);
    }
}

abstract class ActionEvent extends ClientEvent{
    static wrap(data:SerializableType):SerializableType{
        return {isAction:true, data};
    }
}
abstract class ActionEventToOther extends ServerEvent{
    public readonly data:SerializableType;
    constructor(type:string, data:SerializableType) {
        super(type+"Action");
        this.data=data;
    }
}
export class DrawAction extends ActionEvent{
    constructor() {
        super("Draw");
    }
    serialize(): SerializableType {
        return ActionEvent.wrap("draw");
    }
}
export class DrawActionToOther extends ActionEventToOther{
    constructor() {
        super("Draw", undefined);
    }
    apply(game: Game): void {
    }
}
export class PlaceAction extends ActionEvent{
    public readonly cardId:number;
    constructor(id:number) {
        super("Place");
        this.cardId=id;
    }
    serialize(): SerializableType {
        return ActionEvent.wrap(this.cardId);
    }
}
export class PlaceActionToOther extends ActionEventToOther{
    constructor(data:SerializableType) {
        super("Place", data);
    }
    apply(game: Game): void {
    }
}
export class ScareAction extends ActionEvent{
    public readonly scarerId:number;
    public readonly scaredId:number;
    public readonly attackingWith:CardColor;
    constructor(scarerId:number, scaredId:number, attackingWith:CardColor) {
        super("Scare");
        this.scarerId=scarerId;
        this.scaredId=scaredId;
        this.attackingWith=attackingWith;
    }
    serialize(): SerializableType {
        return ActionEvent.wrap({
            self:this.scarerId,
            scared:this.scaredId,
            color:this.attackingWith
        });
    }
}
export class ScareActionToOther extends ActionEventToOther{
    constructor(data:SerializableType) {
        super("Scare", data);
    }
    apply(game: Game): void {
    }
}
export class CardAction extends ActionEvent{
    public readonly cardId:number;
    public readonly actionName:string;
    public readonly data:SerializableType;
    constructor(cardId:number, actionName:string, data:SerializableType) {
        super("Card");
        this.cardId=cardId;
        this.actionName=actionName;
        this.data=data;
    }
    serialize(): SerializableType {
        return ActionEvent.wrap({
            self:this.cardId,
            name:this.actionName,
            data:this.data
        });
    }
}
export class CardActionActionToOther extends ActionEventToOther{
    constructor(data:SerializableType) {
        super("Card", data);
    }
    apply(game: Game): void {
    }
}
export class PassAction extends ActionEvent{
    constructor() {
        super("Pass");
    }
    serialize(): SerializableType {
        return ActionEvent.wrap("pass");
    }
}
export class PassActionActionToOther extends ActionEventToOther{
    constructor(data:SerializableType) {
        super("Pass", data);
    }
    apply(game: Game): void {
    }
}
