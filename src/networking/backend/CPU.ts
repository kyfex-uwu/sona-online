import Game, {GameMiscDataStrings} from "../../Game.js";
import {CardAction, DrawAction, type Event, PassAction, PlaceAction, ScareAction, StartRequestEvent} from "../Events.js"
import {BeforeGameState, TurnState} from "../../GameStates.js";
import {Side} from "../../GameElement.js";
import cards from "../../Cards.js";
import Card, {getVictim, Stat} from "../../Card.js";
import {parseEvent} from "./BackendServer.js";
import {
    type BROY_WEASLA_INCREASE_DATA,
    CardActionOptions,
    type COWGIRL_COYOTE_INCREASE_DATA, type DCW_GUESS,
} from "../CardActionOption.js";
import type {Level} from "../../CardData.js";

export function randFrom<T>(a:T[]):T|undefined{
    return a[Math.floor(Math.random()*a.length)];
}

export function canBeat(attacker:Card, attacked:Card){
    if( (attacker.stat(Stat.RED) ?? -1) >= (attacked.stat(getVictim(Stat.RED)) ?? 999) ) return Stat.RED;
    if( (attacker.stat(Stat.BLUE) ?? -1) >= (attacked.stat(getVictim(Stat.BLUE)) ?? 999) ) return Stat.BLUE;
    if( (attacker.stat(Stat.YELLOW) ?? -1) >= (attacked.stat(getVictim(Stat.YELLOW)) ?? 999) ) return Stat.YELLOW;

    return false;
}
export function calcStrength(attacker:Card, victims:Card[]){
    return victims.map(v=>canBeat(attacker, v)!==false).reduce((a,c)=>c?a+1:a,0);
}
export function calcWeakness(attacked:Card, attackers:Card[]){
    return attackers.map(v=>canBeat(v, attacked)!==false).reduce((a,c)=>c?a+1:a,0);
}

export default class CPU{
    public game:Game=undefined!;
    public readonly generatedDeck:string[];
    public readonly miscData:{
        dcwData?:{ targetLevel:Level, lastGuess:boolean }
    } = {};
    constructor() {
        this.generatedDeck = new Array(19).fill(0).map(_=>"og-"+Math.floor(Math.random()*44+1).toString().padStart(3,"0"))
            .concat(randFrom(Object.values(cards).filter(card=>card.level === 1))!.name);
    }

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
        }else if(event instanceof CardAction){
            switch(event.data.actionName){
                case CardActionOptions.DCW_GUESS:{
                    const data = event.data.cardData as DCW_GUESS;
                    console.log(data)
                    if(data===undefined) {
                        let not = randFrom([1, 2, 3])
                        for (const i of [1, 2, 3])
                            if (i !== not)
                                parseEvent(new CardAction({
                                    cardId: -1,
                                    actionName: CardActionOptions.DCW_GUESS,
                                    cardData: randFrom([1, 2, 3])
                                }, this));
                    }else{
                        if(this.miscData.dcwData?.targetLevel === data) {
                            delete this.miscData.dcwData;
                            break;
                        }else if(this.miscData.dcwData?.lastGuess){
                            parseEvent(new CardAction({
                                cardId: this.game.fieldsB.find(card=>card?.cardData.name === "og-032")!.id,
                                actionName: CardActionOptions.DCW_SCARE,
                                cardData: {
                                    side: Side.A,
                                    pos: randFrom(this.game.fieldsA
                                        .map((card, i) => card === undefined ? undefined : i)
                                        .filter(v => v !== undefined))
                                }
                            }, this));
                        }
                        this.miscData.dcwData!.lastGuess=true;
                    }
                }break;
                case CardActionOptions.FOXY_MAGICIAN_GUESS:{
                    console.trace("hello")
                    parseEvent(new CardAction({
                        cardId:-1,
                        actionName:CardActionOptions.FOXY_MAGICIAN_GUESS,
                        cardData:randFrom([1,2,3])
                    },this));
                }break;
                case CardActionOptions.LITTLEBOSS_IMMUNITY:{
                    parseEvent(new CardAction({
                        cardId:-1,
                        actionName:CardActionOptions.LITTLEBOSS_IMMUNITY,
                        cardData:true
                    }, this));
                }break;
                case CardActionOptions.COWGIRL_COYOTE_INCREASE:{
                    const data = event.data.cardData as COWGIRL_COYOTE_INCREASE_DATA;
                    parseEvent(new CardAction({
                        cardId:-1,
                        actionName:CardActionOptions.COWGIRL_COYOTE_INCREASE,
                        cardData:{
                            stat:data.stat,
                            pos:data.pos
                        }
                    }, this));
                }break;
                case CardActionOptions.BROY_WEASLA_INCREASE:{
                    const data = event.data.cardData as BROY_WEASLA_INCREASE_DATA;
                    parseEvent(new CardAction({
                        cardId:-1,
                        actionName:CardActionOptions.BROY_WEASLA_INCREASE,
                        cardData:{
                            stat:data.stat,
                            pos:data.pos
                        }
                    }, this));
                }break;
                case CardActionOptions.NOBLE_RETARGET:{
                    parseEvent(new CardAction({
                        cardId: -1,
                        actionName: CardActionOptions.NOBLE_RETARGET,
                        cardData: [true]
                    }, this));
                }break;
            }
        }
    }

    takeAction(){
        if(!this.game || this.game.getMiscData(GameMiscDataStrings.FROZEN)?.isFrozen) return false;

        if(!(
            this.game.state instanceof TurnState &&
            this.game.state.turn === Side.B))
            return false;
        if(!this.game.state.drawnToStart){
            console.log("draw to start")
            parseEvent(new DrawAction({}, this));
            return true;
        }

        const fieldCards = this.game.fieldsB.filter(card=>card !== undefined);
        if(fieldCards.length<2){
            if(this.game.handB.length === 0 && this.game.state.actionsLeft>0){
                console.log("draw")
                parseEvent(new DrawAction({},this));
                return true;
            }else {
                const topLevel = Math.max(0, ...fieldCards.map(card => card!.cardData.level)) + 1;
                let picked = this.game.handB.filter(card => card.cardData.level <= topLevel)
                    .sort((c1, c2) => c2.cardData.level - c1.cardData.level)
                    .filter((card, _, valid) => card.cardData.level === valid[0]!.cardData.level);
                if(this.game.state.actionsLeft===0)
                    picked=picked.filter(card=>card.isAlwaysFree());
                if(picked.length>0) {
                    console.log("place")
                    parseEvent(new PlaceAction({
                        cardId: randFrom(picked)!.id,
                        side: Side.B,
                        position: randFrom(this.game.fieldsB.map((card, i) => [card, i] satisfies [Card | undefined, number])
                            .filter(data => data[0] === undefined)
                            .map(data => data[1] + 1) as (1 | 2 | 3)[])!
                    }, this));
                    return true;
                }
            }
        }

        if(this.game.state.actionsLeft>0 && !this.game.getMiscData(GameMiscDataStrings.IS_FIRST_TURN)) {
            const danger = this.game.fieldsA.map((attacker, i) =>
                [attacker, i, attacker === undefined ? 0 : calcStrength(attacker, this.game.fieldsB
                    .filter(v => v !== undefined))] satisfies [Card | undefined, number, number])
                .sort((a, b) => b[2] - a[2])
                .filter((attacked) => attacked[0] === undefined ? false :
                    calcWeakness(attacked[0], this.game.fieldsB.filter(v=>v!==undefined).filter(v=>!v?.hasAttacked))>0);
            if (danger[0]?.[0] !== undefined) {
                for(let i=0;i<3;i++){
                    const maybeAttacker = this.game.fieldsB[i];
                    if(maybeAttacker!==undefined && !maybeAttacker.hasAttacked){
                        const beatsStat=canBeat(maybeAttacker, danger[0][0]);
                        if(beatsStat!==false) {
                            console.log("scare")
                            parseEvent(new ScareAction({
                                scarerPos: [i + 1 as 1 | 2 | 3, Side.B],
                                scaredPos: [danger[0][1] + 1 as 1 | 2 | 3, Side.A],
                                attackingWith: beatsStat,
                            }, this));
                            return true;
                        }
                    }
                }
            }
        }

        console.log("end turn")
        parseEvent(new PassAction({},this));
        return false;
    }
}