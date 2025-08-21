import {CardColor} from "../Card.js";
import {Side} from "../GameElement.js";
import type Game from "../Game.js";

const eventIdGenerator = ()=>Math.random();
export type SerializableType = string|number|boolean|undefined|{[k:string]:SerializableType}|Array<SerializableType>;

export abstract class Event<T extends {[k:string]:SerializableType}>{
    public readonly data:T;
    public readonly game:Game|undefined;
    public readonly sender:{send:(v:string)=>void}|undefined;
    public readonly id;
    constructor(data:T, game?:Game, sender?:{send:(v:string)=>void}, id?:number) {
        this.data=data;
        this.game=game;
        this.sender=sender;
        this.id=id||eventIdGenerator();
        this.init();
    }
    init(){}
    serialize(): string {
        return JSON.stringify({
            id:this.id,
            type:this.constructor.name,
            data:this.data
        });
    }
}

//--

export class ClarifyCardEvent extends Event<{
    id:number,
    cardDataName:string,
}>{}

export class FindGameEvent extends Event<{
    deck:Array<string>,
}>{}
export class GameStartEvent extends Event<{
    deck:Array<{type:string, id:number}>,
    otherDeck:Array<number>,
    which:Side,
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
    position:number,
    side:Side,
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
