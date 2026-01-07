//The side of some element
import type Game from "./Game.js";

export enum Side{
    A,
    B
}

//@returns the opposite side
export function other(side:Side):Side{
    switch(side){
        case Side.A: return Side.B;
        case Side.B: return Side.A;
    }
}

//An element of a logical game
export interface GameElement{
    getSide():Side;
    getGame():Game;
}
