export enum Side{
    A,
    B
}
export function other(side:Side):Side{
    switch(side){
        case Side.A: return Side.B;
        case Side.B: return Side.A;
    }
}

export interface GameElement{
    getSide():Side;
}
