export enum Side{
    YOU,
    THEM
}
export function other(side:Side):Side{
    switch(side){
        case Side.YOU: return Side.THEM;
        case Side.THEM: return Side.YOU;
    }
}

export interface GameElement{
    getSide():Side;
}
