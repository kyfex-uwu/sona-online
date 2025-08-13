let globalID=0;

export default class CardData{
    public readonly imagePath: string;
    public readonly stats: [number?,number?,number?];
    public readonly id:number;
    public readonly level:1|2|3;
    public readonly name:string

    constructor(imagePath:string, stats:[number?,number?,number?], level:1|2|3, name:string) {
        this.imagePath=imagePath;
        this.stats=stats;
        this.level=level;
        this.id=globalID++;
        this.name=name;
    }
}
