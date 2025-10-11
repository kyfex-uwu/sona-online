import {Side} from "./GameElement.js";
import Game from "./Game.js";

//Shuffles the array in place and returns it
export function shuffled<T>(array:Array<T>):Array<T>{
    let shuffledMarker = array.length;

    while (shuffledMarker>1) {
        const nextIndex = Math.floor(Math.random() * shuffledMarker);
        shuffledMarker--;
        // @ts-ignore
        [array[shuffledMarker], array[nextIndex]] = [array[nextIndex], array[shuffledMarker]];
    }

    return array;
}

/**
 * Returns either param a or param b, depending on the given side
 * @param side The side that determines what to return. If this is a {@link Game}, use the game's side
 */
export function sideTernary<T>(side:Side, a:T, b:T){
    return side == Side.A ? a : b;
}

//@param ms The amount of milliseconds to wait
export async function wait(ms:number){
    let resolve:(v:any)=>void=()=>{};
    const p = new Promise(r=>resolve=r);
    setTimeout(resolve, ms);
    await p;
}
