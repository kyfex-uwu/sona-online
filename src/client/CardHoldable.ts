import type VisualGame from "./VisualGame.js";
import type VisualCard from "./VisualCard.js";

export interface CardHoldable{
    removeCard(game:VisualGame, card:VisualCard):void;
    unchildCard(game:VisualGame, card:VisualCard):void;
    addCard(game:VisualGame, card:VisualCard):void;
}
