import VisualCard from "../../client/VisualCard.js";
import {Side, sideTernary} from "../../consts.js";
import type VisualGame from "../../client/VisualGame.js";
import {CardAction} from "../Events.js";
import type {AMBER_PICK, FURMAKER_PICK, WORICK_RESCUE, YASHI_REORDER} from "../CardActionOption.js";

export function lupineDraw(side:Side, game:VisualGame){
    sideTernary(side, game.deckA, game.deckB).drawCard(true);
}

export function brownieDraw(id:number, game:VisualGame){
    const card = game.elements.find(element => VisualCard.getExactVisualCard(element) &&
        (element as VisualCard).logicalCard.id === id) as VisualCard;
    if (card) {
        sideTernary(card.logicalCard.side, game.deckA, game.deckB).removeCard(card);
        sideTernary(card.logicalCard.side, game.handA, game.handB).addCard(card);
        card.flipFaceup();
        sideTernary(card.logicalCard.side, game.deckA, game.deckB).shuffle();
    }
}

export function worickRescue(id:number, side:Side, game:VisualGame){
    const removeFrom = sideTernary(side, game.runawayA, game.runawayB);
    const cardToRemove = game.elements.find(element =>
        VisualCard.getExactVisualCard(element) !== undefined &&
        element instanceof VisualCard && element.logicalCard.id === id) as VisualCard;
    removeFrom.removeCard(cardToRemove);
    sideTernary(side, game.handA, game.handB).addCard(cardToRemove);
}

export function amberPick(which:"keep_1"|"keep_2", side:Side, game:VisualGame){
    const toReorder = sideTernary(side, game.deckA, game.deckB).getCards();
    let [card1, card2] = [toReorder.at(-1), toReorder.at(-2)];
    card1?.flipFaceup();
    card2?.flipFaceup();
    if(which === "keep_2") [card1, card2] = [card2, card1];
    if(card1 !== undefined) sideTernary(side, game.handA, game.handB).addCard(card1);
    if(card2 !== undefined) sideTernary(side, game.runawayA, game.runawayB).addCard(card2);
    game.state.decrementTurn();
}

export function furmakerPick(id:number, side:Side, game:VisualGame){
    const removeFrom = sideTernary(side, game.deckA, game.deckB);
    const cardToRemove = game.elements.find(element =>
        VisualCard.getExactVisualCard(element) !== undefined &&
        element instanceof VisualCard && element.logicalCard.id === id) as VisualCard;
    removeFrom.removeCard(cardToRemove);
    cardToRemove.flipFaceup();
    sideTernary(side, game.handA, game.handB).addCard(cardToRemove);
    sideTernary(side, game.deckA, game.deckB).shuffle();
}

export function yashiReorder(reorder:[number?,number?,number?], side:Side, game:VisualGame){
    const deckDrawFrom = sideTernary(side, game.deckA, game.deckB);
    const cards = deckDrawFrom.getCards();
    for(const card of reorder.map(id=>cards.find(card=>card.logicalCard.id === id))
        .reverse()){
        if(card === undefined) continue;

        deckDrawFrom.removeCard(card);
        deckDrawFrom.addCard(card);
    }
}