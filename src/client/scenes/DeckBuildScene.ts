import {Scene} from "./Scene.js";
import cards, {specialCards} from "../../Cards.js";
import type CardData from "../../CardData.js";
import {camera, scene} from "../clientConsts.js";
import {Euler, Quaternion, Vector3} from "three";
import {SuperficialVisualCard} from "../SuperficialVisualCard.js";
import VisualGame from "../VisualGame.js";

const deck:string[] = [];
const alreadyAdded:{[k:string]:true} = {};
const cardsValues = Object.values(cards);
for(let i=0;i<20;i++) {
    let toAdd:CardData;
    do {
        toAdd = cardsValues[Math.floor(Math.random() * cardsValues.length)]!;
    }while(specialCards.has(toAdd.name) || alreadyAdded[toAdd.name] || (i===0 && toAdd.level !== 1));

    deck[i]=toAdd.name;
    alreadyAdded[toAdd.name]=true;
}
export const getDeck = ()=>deck;

export class DeckBuildScene extends Scene{
    private readonly fakeGame = new VisualGame(scene);
    private readonly cards = Object.values(cards).map(card=>
        new SuperficialVisualCard(this.fakeGame, card.name, new Vector3(0,-100,0)));
    private readonly dest:[Vector3, Quaternion];
    constructor() {
        super();
        const xz = new Vector3(0,0,1).applyQuaternion(camera.quaternion).multiply(new Vector3(1,0,1))
            .normalize();
        const dir = Math.abs(xz.x) < 0.2 ? (Math.sign(xz.z)+1) : (Math.sign(xz.x)+2);
        this.dest = [new Vector3(300,100,0).applyEuler(new Euler(0,(dir-1)*Math.PI/2,0)),
            new Quaternion().setFromEuler(new Euler(0,Math.PI/2*(dir+2),0))];

        for(const card of this.cards){
            
        }
    }
    exit(): void {
        this.fakeGame.release();
    }

    tick(): void {
        camera.position.lerp(this.dest[0],0.01);
        camera.quaternion.slerp(this.dest[1], 0.01);
    }

}
