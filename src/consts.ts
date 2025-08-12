import {Side} from "./GameElement.js";
import {CurrentTurn} from "./Game.js";

export const updateOrder: {[k:string]:number}={};

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

export function sidesMatch(side1:Side, side2:CurrentTurn){
    return (side1 === Side.YOU && side2 == CurrentTurn.YOURS) ||
        (side1 == Side.THEM && side2 == CurrentTurn.THEIRS);
}
