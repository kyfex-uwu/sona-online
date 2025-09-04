import {Side} from "./GameElement.js";
import Game, {CurrentTurn} from "./Game.js";

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
    return (side1 === Side.A && side2 == CurrentTurn.A) ||
        (side1 == Side.B && side2 == CurrentTurn.B);
}

export function sideTernary<T>(side:Side|Game, youVal:T, themVal:T){
    if(side instanceof Game) side = side.mySide;
    return side == Side.A ? youVal : themVal;
}
