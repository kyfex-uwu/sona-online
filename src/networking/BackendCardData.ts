import CardData, {CardActionType} from "../CardData.js";
import cards from "../Cards.js";
import {CardAction, ClarificationJustification, ClarifyCardEvent, multiClarifyFactory} from "./Events.js";
import {CardActionOptions} from "./CardActionOption.js";
import {draw, sendToClients} from "./BackendServer.js";
import {sideTernary} from "../consts.js";
import {GameMiscDataStrings} from "../Game.js";
import {Side} from "../GameElement.js";

export function loadBackendWrappers(){}

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}

wrap(cards["og-022"]!, CardActionType.AFTER_SCARED, (orig, {self, scarer, stat, game})=>{
    if(orig) orig({self, scarer, stat, game});

    draw(game, undefined, self.side, false);//todo: this should be a card action i think. just for organization
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
