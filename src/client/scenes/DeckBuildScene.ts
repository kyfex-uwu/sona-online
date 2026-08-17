import {Scene} from "./Scene.js";
import cards, {specialCards} from "../../Cards.js";
import type CardData from "../../CardData.js";
import {dragListener, removeDragListener, removeWheelListener, wheelListener} from "../clientConsts.js";
import {button, buttonId, invisibleButton, registerDrawCallback} from "../ui.js";
import p5 from "p5";
import {setScene} from "../../index.js";
import {MainMenuScene} from "./MainMenuScene.js";

const decks={
    canine:[37,7,40,33,2,16,34,19,36,8,28,5,25,18,31,35,20,1,30,15].map(v=>"og-"+v.toString().padStart(3,"0")),
    feline:[12,26,17,4,13,10,6,39,23,21,24,22,32,11,3,27,14,38,29,9].map(v=>"og-"+v.toString().padStart(3,"0")),
}
const deck:string[] = [...decks.canine];
const disabledCards:string[] = [];
export const getDeck = ()=>deck;
const backButtonId = buttonId();
const clearButtonId = buttonId();
const deckButtonIds = {
    canine:buttonId(),
    feline:buttonId(),
}
export class DeckBuildScene extends Scene{
    private readonly cards = Object.values(cards).filter(card=>!specialCards.has(card.name)).map(v=>
        [v,buttonId()] satisfies [CardData,number]);
    private readonly dragListener;
    private readonly wheelListener;
    private readonly release: () => void;
    constructor() {
        super();

        let offset=0;
        let images:{[k:string]:true|p5.Image} = {}
        this.release = registerDrawCallback(0, (p5,scale)=>{
            p5.background(56,85,86);

            p5.push();
            p5.noStroke();
            let i=0;
            while(this.cards[i]) {
                const x = i%4;
                const card=this.cards[i]!;

                invisibleButton(p5,
                    (x + 0.1) * scale * 0.6,
                    (Math.floor(i / 4) + 0.1) * scale * 0.8 + offset,
                    scale * 0.5, scale * 0.7,
                ()=>{
                    if(disabledCards.includes(card[0].name)) return;

                    if(deck.includes(card[0].name))
                        deck.splice(deck.indexOf(card[0].name),1);
                    else
                        deck.push(card[0].name);
                },card[1],(isIn)=>{
                    if(disabledCards.includes(card[0].name)) isIn=false;

                    if(images[card[0].name] === undefined){
                        images[card[0].name]=true;
                        p5.loadImage(`/assets/card-images/${card[0].imagePath}`, (image:p5.Image) => {
                            images[card[0].name]=image;
                        });
                    }else if(images[card[0].name] !== true) {
                        p5.fill(255,100);

                        if(deck.includes(card[0].name)){
                            p5.rect((x + 0.1) * scale * 0.6 - scale*0.03,
                                (Math.floor(i / 4) + 0.1) * scale * 0.8 + offset - scale*0.03,
                                scale * 0.56, scale * 0.76)
                        }

                        p5.image(images[card[0].name],
                            (x + 0.1) * scale * 0.6, (Math.floor(i / 4) + 0.1) * scale * 0.8 + offset, scale * 0.5, scale * 0.7);

                        if(isIn){
                            p5.rect((x + 0.1) * scale * 0.6, (Math.floor(i / 4) + 0.1) * scale * 0.8 + offset, scale * 0.5, scale * 0.7);

                            p5.image(images[card[0].name],
                                p5.width-scale*0.5*2-scale*0.03, p5.height-scale*0.7*2-scale*0.03, scale * 0.5*2, scale * 0.7*2);
                        }else if(disabledCards.includes(card[0].name)){
                            p5.fill(100,150);
                            p5.rect((x + 0.1) * scale * 0.6, (Math.floor(i / 4) + 0.1) * scale * 0.8 + offset, scale * 0.5, scale * 0.7);
                        }
                    }
                },false);

                i++;
            }
            p5.pop();

            button(p5, p5.width-scale*0.73,scale*0.03,scale*0.7,scale*0.3,"Save",()=>{
                setScene(()=>new MainMenuScene())
            },scale,backButtonId,
                deck.length !== 20 ||
                !deck.some(name=>cards[name]?.level === 1));
            button(p5, p5.width-scale*1.46,scale*0.03,scale*0.7,scale*0.3,"Clear",()=>{
                deck.length=0;
            },scale,clearButtonId,false);
            button(p5, p5.width-scale*0.73,scale*0.36,scale*0.7,scale*0.3,"Canine",()=>{
                deck.length=0;
                deck.splice(0,0,...decks.canine);
            },scale,deckButtonIds.canine,false);
            button(p5, p5.width-scale*1.46,scale*0.36,scale*0.7,scale*0.3,"Feline",()=>{
                deck.length=0;
                deck.splice(0,0,...decks.feline);
            },scale,deckButtonIds.feline,false);

            p5.push();
            p5.textAlign(p5.RIGHT,p5.TOP);
            p5.textSize(scale*0.1)
            p5.fill(255);
            p5.text((deck.length === 20 ? "" : `Deck must be 20 cards, currently ${deck.length}\n`) +
                (deck.some(name=>cards[name]?.level === 1) ? "" : "Deck must have at least 1 level 1 card"),
                p5.width-scale*0.03,scale*0.7);
            p5.pop();

        });
        let offsetStart=0;
        this.dragListener=dragListener(({type,x,y})=>{
            switch (type){
                case "start":
                    offsetStart=y-offset;
                    break;
                case "move":
                    offset = Math.min(0,y-offsetStart);
                    break;
            }
        });
        this.wheelListener = wheelListener((dy)=>{
            offset = Math.min(0,offset-dy*0.2);
            return true;
        })
    }
    exit(): void {
        removeDragListener(this.dragListener);
        removeWheelListener(this.wheelListener);
        this.release();
    }

    tick(): void {

    }
}
