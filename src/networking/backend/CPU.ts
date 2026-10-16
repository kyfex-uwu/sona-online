import Game, {GameMiscDataStrings} from "../../Game.js";
import {
    CardAction,
    ClarificationJustification,
    ClarifyCardEvent,
    DrawAction,
    type Event,
    PassAction,
    PlaceAction,
    ScareAction,
    StartRequestEvent
} from "../Events.js"
import {BeforeGameState, TurnState} from "../../GameStates.js";
import {Side} from "../../GameElement.js";
import cards, {specialCards} from "../../Cards.js";
import Card, {getVictim, Stat} from "../../Card.js";
import {parseEvent} from "./BackendServer.js";
import {
    type BROY_WEASLA_INCREASE_DATA,
    CardActionOptions,
    type COWGIRL_COYOTE_INCREASE_DATA,
    type FOXY_MAGICIAN_GUESS,
} from "../CardActionOption.js";
import type {Level} from "../../CardData.js";
import {EventWaiter, levelOr, randFrom, shuffled} from "../../consts.js";

export function canBeat(attacker:Card, attacked:Card){
    if( (attacker.stat(Stat.RED) ?? -1) >= (attacked.stat(getVictim(Stat.RED)) ?? Infinity) ) return Stat.RED;
    if( (attacker.stat(Stat.BLUE) ?? -1) >= (attacked.stat(getVictim(Stat.BLUE)) ?? Infinity) ) return Stat.BLUE;
    if( (attacker.stat(Stat.YELLOW) ?? -1) >= (attacked.stat(getVictim(Stat.YELLOW)) ?? Infinity) ) return Stat.YELLOW;

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
    public readonly waiter = new EventWaiter();
    constructor() {
        this.generatedDeck = new Array(19).fill(0).map(()=>randFrom(Object.values(cards)
                .filter(card=>!specialCards.has(card.name)))!)
            .concat(randFrom(Object.values(cards).filter(card=>!specialCards.has(card.name) && card.level === 1))!)
            .map(card=>card.name);
    }

    private sentStartRequest=false;
    send(event:Event<any>){
        if(!this.waiter.process(event)) return;

        if(event instanceof DrawAction){
            if(!this.sentStartRequest &&
                this.game.state instanceof BeforeGameState &&
                this.game.handB.length===3) {

                const toStart = this.game.handB.filter(card => card.cardData.level === 1)
                    .map(card => [card, Math.min(card.stat(Stat.RED) ?? Infinity, card.stat(Stat.BLUE) ?? Infinity, card.stat(Stat.YELLOW) ?? Infinity)] satisfies [Card, number])
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
                    const guesses = shuffled([1,2,3] as Level[]);
                    guesses.splice(Math.floor(Math.random()*guesses.length),1);

                    parseEvent(new CardAction({
                        cardId: -1,
                        actionName: CardActionOptions.DCW_GUESS,
                        cardData: guesses[0]!
                    }, this));

                    let finished=false;
                    this.waiter.waitFor(event=>event instanceof ClarifyCardEvent && event.data.justification === ClarificationJustification.DCW,
                        ()=>{
                            finished=true;
                            return true;
                        });
                    this.waiter.waitFor(event=>event instanceof CardAction && event.data.actionName === CardActionOptions.DCW_GUESS,
                        ()=>{
                            if(!finished) {
                                parseEvent(new CardAction({
                                    cardId: -1,
                                    actionName: CardActionOptions.DCW_GUESS,
                                    cardData: guesses[1]!
                                }, this));
                                this.waiter.waitFor(event => event instanceof CardAction && event.data.actionName === CardActionOptions.DCW_GUESS,
                                    () => false);
                            }
                            return false;
                        });
                }break;
                case CardActionOptions.FOXY_MAGICIAN_GUESS:{
                    if((event.data.cardData as FOXY_MAGICIAN_GUESS) === undefined)
                        parseEvent(new CardAction({
                            cardId:-1,
                            actionName:CardActionOptions.FOXY_MAGICIAN_GUESS,
                            cardData: randFrom([1, 2, 3] as Level[])!
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
        //do i need to wait for cpu waiter? probably

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
                const topLevel = Math.max(0, ...fieldCards.map(card => levelOr(card!.cardData.level,0))) + 1;
                let picked = this.game.handB.filter(card => levelOr(card.cardData.level,0) <= topLevel)
                    .sort((c1, c2) => levelOr(c2.cardData.level,0) - levelOr(c1.cardData.level,0))
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