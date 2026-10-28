import type CardData from "./CardData.js";
import type { CardTriggerType, Level } from "./CardData.js";
import {type Event} from "./networking/Events.js";

//Shuffles the array in place and returns it
export function shuffled<T>(array:Array<T>):Array<T>{
    let shuffledMarker = array.length;

    while (shuffledMarker>1) {
        const nextIndex = Math.floor(Math.random() * shuffledMarker);
        shuffledMarker--;
        [array[shuffledMarker], array[nextIndex]] = [array[nextIndex]!, array[shuffledMarker]!];
    }

    return array;
}

export enum Side {
    A,
    B
}

/**
 * Returns either param a or param b, depending on the given side
 * @param side The side that determines what to return. If this is a {@link Game}, use the game's side
 */
export function sideTernary<T>(side:Side, a:T, b:T){
    return side == Side.A ? a : b;
}

//Which stat on a card
export enum Stat {
    RED = 0,
    BLUE = 1,
    YELLOW = 2
}

export function statTernary<T>(stat:Stat, red:T, blue: T, yellow:T){
    switch(stat){
        case Stat.RED: return red;
        case Stat.BLUE: return blue;
        default: return yellow;
    }
}

//@param ms The amount of milliseconds to wait
export async function wait(ms:number){
    let resolve:()=>void=()=>{};
    const p = new Promise<void>(r=>resolve=r);
    setTimeout(resolve, ms);
    await p;
}

export function verifyNoDuplicateStrVals<T>(miscDataStrings: { [k: string]: T }, toThrow:string){
    const checker = new Set<T|undefined>();
    for(const key in miscDataStrings){
        if(checker.has(miscDataStrings[key])) throw toThrow;
        checker.add(miscDataStrings[key]!);
    }
}

export function externalPromise<T=void>(){
    let resolve:(v:T)=>void=undefined!;
    //@ts-expect-error its fixed in the next line
    const toReturn:
        Promise<T> & {resolve:(v:T)=>void} = new Promise<T>(r=>resolve=r);
    toReturn.resolve=resolve;

    return toReturn;
}

export function wrap<P extends {
    [k: string]: any;
}, R>(data: CardData, action: CardTriggerType<P, R>, wrapper: (orig: ((params: P) => R) | undefined, args: P) => R) {
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}

export function levelOr(level:Level|undefined, or:0|1e999|1){

    return typeof level !== "number" ? or : level;
}

export class WaitChain {
    private chain: Promise<void> = new Promise<void>(r => r());

    run(callback: () => Promise<any>) {
        this.chain = this.chain.then(async () => await callback());
    }

    async end() {
        let currentChain;
        do {
            currentChain = this.chain;
            await currentChain;
        } while (currentChain !== this.chain);
    }
}

export class EventWaiter{
    private readonly waitingFor:({filter:(event:Event<any>)=>boolean,callback:(event:Event<any>)=>boolean})[] = [];

    /**
     *
     * @param filter Returns true if the event is hat you're looking for
     * @param callback Performs some action, and returns if the event should be handled normally (if not, it is consumed)
     */
    waitFor(filter:(event:Event<any>)=>boolean, callback:(event:Event<any>)=>boolean){
        this.waitingFor.push({filter,callback});
    }
    process(event:Event<any>){
        for(let i=0;i<this.waitingFor.length;i++){
            if(this.waitingFor[i]!.filter(event)){
                const processNormally = this.waitingFor[i]!.callback(event);
                this.waitingFor.splice(i,1);
                return processNormally;
            }
        }
        return true;
    }
}

export function randFrom<T>(a: T[]): T | undefined {
    return a[Math.floor(Math.random() * a.length)];
}

export function enumValues(eenum:any){
    return Object.values(eenum).filter(v=>typeof v === "number");
}

export function setFind<T>(set:Set<T>, filter:(item:T)=>boolean){
    for(const item of set)
        if(filter(item)) return item;
    return undefined;
}