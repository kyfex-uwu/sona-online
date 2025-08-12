import {CardColor} from "../Card.js";
import {Side} from "../GameElement.js";

const eventIdGenerator = ()=>Math.random();
export type SerializableType = string|number|boolean|undefined|{[k:string]:SerializableType}|Array<SerializableType>;

export abstract class Event<T extends {[k:string]:SerializableType}>{
    public readonly data:T;
    constructor(data:T) {
        this.data=data;
        this.init();
    }
    init(){}
    public readonly id = eventIdGenerator();
    serialize(): string {
        return JSON.stringify({
            id:this.id,
            type:this.constructor.name,
            data:this.data
        });
    }
}

//--

type SerializableCard = {id:number, name:string};

export class FindGameEvent extends Event<{}>{}
export class GameStartEvent extends Event<{
    yourDeck:Array<SerializableCard>,
    theirDeck:Array<SerializableCard>
}>{}
export class StartRequestEvent extends Event<{
    side?:Side
}>{}
export class DetermineStarterEvent extends Event<{
    starter:Side,
    flippedCoin:boolean
}>{}

export abstract class ActionEvent<T extends {[k:string]:SerializableType}> extends Event<T>{}
export class DrawAction extends ActionEvent<{}>{}
export class PlaceAction extends ActionEvent<{
    cardId:number,
    position:number
}>{}
export class ScareAction extends ActionEvent<{
    scarerId:number,
    scaredId:number,
    attackingWith:CardColor
}>{}
export class CardAction extends ActionEvent<{
    cardId:number,
    actionName:string,
    data:SerializableType
}>{}
export class PassAction extends ActionEvent<{}>{}
