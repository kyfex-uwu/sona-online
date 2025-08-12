export default class CardData{
    public readonly imagePath: string;
    public readonly stats: [number?,number?,number?];
    //todo
    constructor(imagePath:string, stats:[number?,number?,number?]) {
        this.imagePath=imagePath;
        this.stats=stats;
    }
}
