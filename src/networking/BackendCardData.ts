import CardData, {CardActionType} from "../CardData.js";
import cards from "../Cards.js";
import {network} from "./Server.js";
import {CardAction, DrawAction} from "./Events.js";
import {GameMiscDataStrings} from "../Game.js";
import {CardActionOptions} from "./CardActionOption.js";

export function loadBackendWrappers(){}

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}

wrap(cards["og-022"]!, CardActionType.AFTER_SCARED, (orig, {self, scarer, stat, game})=>{
    if(orig) orig({self, scarer, stat, game});

    network.sendToClients(new DrawAction({
        isAction:false,
        side:self.side,
    }, game));
});
wrap(cards["og-024"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    network.sendToClients(new DrawAction({
        isAction:false,
        side:self.side,
    }, game));
});
wrap(cards["og-025"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    network.sendToClients(new CardAction({
        cardId: -1,
        actionName:CardActionOptions.BOTTOM_DRAW,
        cardData:{side:self.side},
    }, game));
});
