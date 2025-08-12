export enum Side{
    YOU,
    THEM
}

export interface GameElement{
    getSide():Side;
}
