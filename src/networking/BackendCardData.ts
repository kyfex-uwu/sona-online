import CardData, {CardActionType} from "../CardData.js";
import cards from "../Cards.js";
import {network} from "./Server.js";
import {CardAction} from "./Events.js";
import {CardActionOptions} from "./CardActionOption.js";
import {draw} from "./BackendServer.js";
import {sideTernary} from "../consts.js";

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

    draw(game, undefined, self.side, false);//todo: this should be a card action i think. just for organization
});
wrap(cards["og-025"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    const card = sideTernary(self.side, game.deckA, game.deckB).shift();
    if(card !== undefined){
        sideTernary(self.side, game.handA, game.handB).push(card);
        network.sendToClients(new CardAction({
            cardId: -1,
            actionName:CardActionOptions.BOTTOM_DRAW,
            cardData:{side:self.side},
        }, game));
    }
});
