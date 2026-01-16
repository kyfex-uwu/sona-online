import CardData, {CardActionType, InterruptScareResult} from "../CardData.js";
import cards from "../Cards.js";
import {CardAction, ClarificationJustification, ClarifyCardEvent, multiClarifyFactory, ScareAction} from "./Events.js";
import {CardActionOptions} from "./CardActionOption.js";
import {draw, sendToClients} from "./BackendServer.js";
import {sideTernary} from "../consts.js";
import {GameMiscDataStrings} from "../Game.js";
import {other, Side} from "../GameElement.js";
import {CardMiscDataStrings, Stat} from "../Card.js";
import {TurnState} from "../GameStates.js";

export function loadBackendWrappers(){}

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}

wrap(cards["og-005"]!, CardActionType.PLACED, (orig, {self, game})=>{
    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.BROWNIE_DRAW);
});
wrap(cards["og-009"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(sideTernary(self.side, game.fieldsB, game.fieldsB)
        .filter(card=>card !== undefined)
        .filter(card=>(card?.stat(Stat.RED)??99)<2 ||
            (card?.stat(Stat.BLUE)??99)<2 ||
            (card?.stat(Stat.YELLOW)??99)<2).length<2)
        return;
    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.GREMLIN_SCARE);
});
wrap(cards["og-015"]!, CardActionType.INTERRUPT_SCARE, (orig,
                                                        {self, scared, scarer, stat, game, origEvent, next})=>{
    if(orig) orig({self, scared, scarer, stat, game, origEvent, next})

    if(self!==scared) return InterruptScareResult.PASSTHROUGH;

    if(self.getMiscData(CardMiscDataStrings.LITTLEBOSS_IMMUNE) !== true) {
        game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.LITTLEBOSS_IMMUNITY);
        self.setMiscData(CardMiscDataStrings.PAUSED_SCARE, next);

        game.player(self.side)?.send(new CardAction({
            cardId:-1,
            actionName:CardActionOptions.LITTLEBOSS_IMMUNITY,
            cardData:false
        }));

        game.freeze((event)=>
            event.sender === game.player(self.side) &&
            event instanceof CardAction);
        return InterruptScareResult.PREVENT_SCARE;
    }else return InterruptScareResult.PASSTHROUGH;
})
wrap(cards["og-022"]!, CardActionType.AFTER_SCARED, (orig, {self, scarer, scared, stat, game})=>{
    if(orig) orig({self, scarer, scared, stat, game});

    if(scared === self) draw(game, undefined, self.side, false, game.player(self.side));//todo: this should be a card action i think. just for organization
});
wrap(cards["og-024"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    draw(game, undefined, self.side, false, game.player(self.side));//todo: this should be a card action i think. just for organization
});
wrap(cards["og-025"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    const card = sideTernary(self.side, game.deckA, game.deckB).shift();
    if(card !== undefined){
        sideTernary(self.side, game.handA, game.handB).push(card);
        sendToClients(new CardAction({
            cardId: -1,
            actionName:CardActionOptions.BOTTOM_DRAW,
            cardData:{side:self.side},
        }, game));
        game.player(self.side)?.send(new ClarifyCardEvent({
            id:card.id,
            cardDataName:card.cardData.name
        }));
    }
});
wrap(cards["og-027"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    game.player(self.side)?.send(multiClarifyFactory(sideTernary(self.side, game.deckA, game.deckB),
        ClarificationJustification.YASHI));
    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.YASHI_REORDER);
});
wrap(cards["og-030"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    for(const side of [Side.A, Side.B])
        for (let i = sideTernary(side, game.handA, game.handB).length; i < 5; i++)
            draw(game, undefined, side, false, game.player(side));
});
wrap(cards["og-031"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.FOXY_MAGICIAN_PICK);
    game.freeze(event=>
        (event instanceof CardAction &&
            event.data.actionName === CardActionOptions.FOXY_MAGICIAN_GUESS &&
            event.sender === game.player(other(self.side))) ||
        (event instanceof CardAction &&
            event.data.actionName === CardActionOptions.FOXY_MAGICIAN_PICK &&
            event.sender === game.player(self.side)) ||
        (event instanceof ClarifyCardEvent &&
            event.data.justification === ClarificationJustification.FOXY_MAGICIAN &&
            event.sender === game.player(self.side)));

    game.player(self.side)?.send(multiClarifyFactory(
        sideTernary(self.side, game.deckA, game.deckB),
        ClarificationJustification.FOXY_MAGICIAN));
});
//has to be preplaced because first turn waiter pushes it to next frame
wrap(cards["og-032"]!, CardActionType.PRE_PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.DCW_PICK);
    game.freeze(event=>
        (event instanceof CardAction &&
            event.data.actionName === CardActionOptions.DCW_GUESS &&
            event.sender === game.player(other(self.side))) ||
        (event instanceof CardAction &&
            event.data.actionName === CardActionOptions.DCW_PICK &&
            event.sender === game.player(self.side)) ||
        (event instanceof ClarifyCardEvent &&
            event.data.justification === ClarificationJustification.DCW &&
            event.sender === game.player(self.side)) ||
        (event instanceof CardAction &&
            event.data.actionName === CardActionOptions.DCW_SCARE &&
            event.sender === game.player(self.side)) ||
        (event instanceof ScareAction &&
            event.isForced() && event.sender === undefined));


    game.player(self.side)?.send(multiClarifyFactory(
        sideTernary(self.side, game.deckA, game.deckB),
        ClarificationJustification.DCW));
});
wrap(cards["og-035"]!, CardActionType.INTERRUPT_SCARE, (orig,
                                                        {self, scared, scarer, stat, game, origEvent, next})=>{
    if(orig) orig({self, scared, scarer, stat, game, origEvent,next});

    if(!(game.state instanceof TurnState && //is a turn
        game.state.turn !== self.side && // is opponents turn
        self.getMiscData(CardMiscDataStrings.ALREADY_ATTACKED) !== true &&//havent done this already
        stat !== "card"//we can actually defend against this
    ))
        return InterruptScareResult.PASSTHROUGH;

    self.setMiscData(CardMiscDataStrings.PAUSED_SCARE, next);
    self.setMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET,
        sideTernary(origEvent.data.scaredPos[1], game.fieldsA, game.fieldsB)[origEvent.data.scaredPos[0]-1]);
    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.COWGIRL_COYOTE_INCREASE);
    game.freeze(event=>
        event instanceof CardAction &&
        event.data.actionName === CardActionOptions.COWGIRL_COYOTE_INCREASE &&
        event.sender === game.player(self.side));
    game.player(self.side)?.send(new CardAction({
        cardId:-1,
        actionName:CardActionOptions.COWGIRL_COYOTE_INCREASE,
        cardData:false
    }));

    return InterruptScareResult.PREVENT_SCARE;
});
wrap(cards["og-035"]!, CardActionType.AFTER_SCARED, (orig, {self, scarer, scared, stat, game})=>{
    if(orig) orig({self, scared, scarer, stat, game});

    const target = self.getMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET);
    self.setMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET,undefined);
    if(target !== undefined)
        delete target.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)![self.cardData.name+self.cardData.id];
});
wrap(cards["og-035"]!, CardActionType.TURN_START, (orig, {self, game})=>{
    if(orig) orig({self, game});
    self.setMiscData(CardMiscDataStrings.ALREADY_ATTACKED, false);
});
wrap(cards["og-029"]!, CardActionType.INTERRUPT_SCARE, (orig,
                                                        {self, scared, scarer, stat, game, origEvent, next})=>{
    if(orig) orig({self, scared, scarer, stat, game, origEvent,next});

    if(!(game.state instanceof TurnState && //is a turn
        game.state.turn === self.side && // is your turn
        !sideTernary(self.side, game.fieldsA, game.fieldsB).some(card=>card?.hasAttacked) && //first scare attempt
        stat !== "card"//we can actually defend against this
    ))
        return InterruptScareResult.PASSTHROUGH;

    self.setMiscData(CardMiscDataStrings.PAUSED_SCARE, next);
    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.BROY_WEASLA_INCREASE);
    game.freeze(event=>
        event instanceof CardAction &&
        event.data.actionName === CardActionOptions.BROY_WEASLA_INCREASE &&
        event.sender === game.player(self.side));
    game.player(self.side)?.send(new CardAction({
        cardId:-1,
        actionName:CardActionOptions.BROY_WEASLA_INCREASE,
        cardData:false
    }));

    return InterruptScareResult.PREVENT_SCARE;
});
wrap(cards["og-029"]!, CardActionType.AFTER_SCARED, (orig, {self, scarer, scared, stat, game})=>{
    if(orig) orig({self, scared, scarer, stat, game});

    const target = self.getMiscData(CardMiscDataStrings.BROY_WEASLA_TARGET);
    if(target === undefined) return;

    delete target.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)![self.cardData.name+self.cardData.id];
    self.setMiscData(CardMiscDataStrings.BROY_WEASLA_TARGET,undefined);
});
