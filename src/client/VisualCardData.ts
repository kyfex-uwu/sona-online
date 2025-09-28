import CardData, {CardActionType} from "../CardData.js";
import cards from "../Cards.js";
import {game as visualGame} from "../index.js";
import {VPickCardsState} from "./VisualGameStates.js";
import type {PickCardsState} from "../GameStates.js";

export function loadFrontendWrappers(){}

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}

wrap(cards["og-005"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    visualGame.setState(new VPickCardsState(visualGame), game.state as PickCardsState);
});
