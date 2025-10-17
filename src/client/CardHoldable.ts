import type VisualCard from "./VisualCard.js";

//Something that can hold and store {@link VisualCard}s
export interface CardHoldable{
    //Removes some card from the game. Should do nothing if this object does not hold the given card
    removeCard(card:VisualCard):void;
    //Adds a card to this object
    addCard(card:VisualCard):void;
}
