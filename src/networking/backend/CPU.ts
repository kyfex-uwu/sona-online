import type Game from "../../Game.js";
import {DrawAction, type Event, PlaceAction, StartRequestEvent} from "../Events.js"
import {BeforeGameState, TurnState} from "../../GameStates.js";
import {Side} from "../../GameElement.js";
import cards from "../../Cards.js";
import Card, {Stat} from "../../Card.js";
import {parseEvent} from "./BackendServer.js";

export default class CPU{
    private game:Game=undefined!;
    public readonly generatedDeck:string[];
    constructor() {
        const lv1Arr = Object.values(cards).filter(card=>card.level === 1);
        this.generatedDeck = new Array(19).fill(0).map(_=>"og-"+Math.floor(Math.random()*44+1).toString().padStart(3,"0"))
            .concat(lv1Arr[Math.floor(Math.random()*lv1Arr.length)]!.name);
    }
    setGame(game:Game){this.game=game;}

    private sentStartRequest=false;
    send(event:Event<any>){
        if(event instanceof DrawAction){
            if(!this.sentStartRequest &&
                this.game.state instanceof BeforeGameState &&
                this.game.handB.length===3) {

                const toStart = this.game.handB.filter(card => card.cardData.level === 1)
                    .map(card => [card, Math.min(card.stat(Stat.RED) ?? 99, card.stat(Stat.BLUE) ?? 99, card.stat(Stat.YELLOW) ?? 99)] satisfies [Card, number])
                    .sort((c1, c2) => c2[1] - c1[1])[0]![0];
                parseEvent(new PlaceAction({
                    cardId: toStart.id,
                    position: 2,
                    side: toStart.side
                }, this));
                parseEvent(new StartRequestEvent({
                    which: "nopref"
                }, this));
                this.sentStartRequest=true;
            }
        }

        //--

        setTimeout(()=>{
            if(this.game.state instanceof TurnState && this.game.state.turn === Side.B && !this.game.state.drawnToStart)
                parseEvent(new DrawAction({},this));
        })
    }

    takeAction(){
        if(!this.game) return;

        if(this.game.state instanceof TurnState && this.game.state.turn === this.mySide){

        }
    }
}