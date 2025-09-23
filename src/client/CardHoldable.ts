import type VisualGame from "./VisualGame.js";
import type VisualCard from "./VisualCard.js";

//Something that can hold and store {@link VisualCard}s
export interface CardHoldable{
    //Removes some card from the game. Should do nothing if this object does not hold the given card
    removeCard(card:VisualCard):void;
    //Removes some card from this object, detaching it completely from anything. Should do nothing if this object does not hold the given card
    unchildCard(card:VisualCard):void;
    //Adds a card to this object
    addCard(card:VisualCard):void;
}
