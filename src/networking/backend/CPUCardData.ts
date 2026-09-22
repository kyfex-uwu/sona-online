import cards from "../../Cards.js";
import {CardTriggerType} from "../../CardData.js";
import {parseEvent} from "./BackendServer.js";
import {CardAction} from "../Events.js";
import {CardActionOptions} from "../CardActionOption.js";
import CPU, {calcStrength, randFrom} from "./CPU.js";
import type Game from "../../Game.js";
import Card, {CardMiscDataStrings, Stat} from "../../Card.js";
import {Side} from "../../GameElement.js";
import {wrap} from "../../consts.js";

export function loadCPUWrappers(){}

function doIfCpu<T extends ((data:U)=>void)|undefined, U extends {game:Game,self:Card}>(wrapper:(orig:T, data:U, cpu:CPU)=>any){
    return (orig:T,data:U)=>{
        if(orig) orig(data);
        if(data.game.isCpu && data.self.side === Side.B)
            setTimeout(()=>wrapper(orig, data, data.game.player(Side.B) as CPU));
    }
}

wrap(cards["og-005"]!, CardTriggerType.PLACED, doIfCpu((orig, {self:card, game}, cpu)=>{
    parseEvent(new CardAction({
        cardId:card.id,
        actionName: CardActionOptions.BROWNIE_DRAW,
        cardData: {
            id:randFrom(game.deckB.filter(card=>card.cardData.level===1 && card.isAlwaysFree()))!.id
        },
    }, cpu))
}));

wrap(cards["og-009"]!, CardTriggerType.PLACED, doIfCpu((orig, {self:card,game}, cpu)=>{
    const target=game.fieldsA
        .map((card,i)=>[card,i] satisfies [Card|undefined, number])
        .filter(data=>data[0]!==undefined &&
            ((data[0].stat(Stat.RED)??99)<2 || (data[0].stat(Stat.BLUE)??99)<2 || (data[0].stat(Stat.YELLOW)??99)<2))
        .map(v=>v[1]);
    if(game.fieldsA.filter(card=>card!==undefined).length>=2 &&//if there are at least 2 cards on opponent field
            target.length>0)
        parseEvent(new CardAction({
            cardId:card.id,
            actionName:CardActionOptions.GREMLIN_SCARE,
            cardData:{ position:(randFrom(target)!+1) as 1|2|3 }
        },cpu))
}));

wrap(cards["og-027"]!, CardTriggerType.PLACED, doIfCpu((orig, {self:card,game}, cpu)=>{
    parseEvent(new CardAction({
        cardId:card.id,
        actionName:CardActionOptions.YASHI_REORDER,
        cardData:{
            cards:game.deckB.map(card=>[card, calcStrength(card, game.deckA)] satisfies [Card, number])
                .sort((a,b)=>b[1]-a[1])
                .map(v=>v[0].id)
                .slice(0,3) as [number?, number?, number?]
        },
    }, cpu));
}));

wrap(cards["og-031"]!, CardTriggerType.PLACED, doIfCpu((orig, {self:card,game}, cpu)=>{
    parseEvent(new CardAction({
        cardId: card.id,
        actionName: CardActionOptions.FOXY_MAGICIAN_PICK,
        cardData: randFrom(game.deckB)!.id
    },cpu));
}));

wrap(cards["og-032"]!, CardTriggerType.PLACED, doIfCpu((orig, {self:card,game}, cpu)=>{
    const picked = randFrom(game.deckB)!;
    parseEvent(new CardAction({
        cardId: card.id,
        actionName: CardActionOptions.DCW_PICK,
        cardData: picked.id
    },cpu));

    cpu.miscData.dcwData = {
        targetLevel:picked.cardData.level,
        lastGuess:false
    }
}));

wrap(cards["og-043"]!, CardTriggerType.PLACED, doIfCpu((orig, {self:card,game}, cpu)=>{
    if(card.getMiscData(CardMiscDataStrings.CLOUD_CAT_ALREADY_PICKED)) return;
    parseEvent(new CardAction({
        cardId:card.id,
        actionName:CardActionOptions.CLOUD_CAT_PICK,
        cardData:randFrom(game.fieldsA.filter(card=>card!==undefined))!.id,
    },cpu));
}));