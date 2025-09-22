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
export function sideTernary<T>(side:Side|Game, a:T, b:T){
    if(side instanceof Game) side = side.mySide;
    return side == Side.A ? a : b;
}
