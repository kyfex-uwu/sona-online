import CardData, {CardActionType, Species} from "../CardData.js";
import cards from "../Cards.js";
import {game as visualGame} from "../index.js";
import {EndType, VPickCardsState, VTurnState} from "./VisualGameStates.js";
import VisualCard from "./VisualCard.js";
import {sideTernary} from "../consts.js";
import {network} from "../networking/Server.js";
import {CardAction, CardActionOptions, ClarificationJustification, ClarifyCardEvent} from "../networking/Events.js";
import {Stat} from "../Card.js";

export function loadFrontendWrappers(){}

export const visualCardClientActions:{[k:string]:(card:VisualCard)=>boolean} = {};

function lastAction(callback:(card:VisualCard)=>boolean){
    return (card:VisualCard)=> {
        if (card.game.state instanceof VTurnState && card.game.state.getActionsLeft() === 1) {
            return callback(card);
        }
        return false;
    }
}

visualCardClientActions["og-001"] = lastAction((card)=>{
    card.game.setState(new VPickCardsState(card.game, [card.game.state, card.game.getGame().state],
            sideTernary(card.getSide(), card.game.fieldsA, card.game.fieldsB).map(field => field.getCard())
            .filter(card => card !== undefined)
            .filter(card => card?.logicalCard.cardData.species === Species.CANINE), (card)=>{

            }, EndType.BOTH),
        card.game.getGame().state);
    return true;
});

//--

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}

wrap(cards["og-005"]!, CardActionType.PLACED, (orig, {self, game})=>{
    if(orig) orig({self, game});

    const cards = sideTernary(self.side, game.deckA, game.deckB).filter(card =>
        card.cardData.level === 1 && card.cardData.getAction(CardActionType.IS_FREE) !== undefined);
    for(const card of cards){
        network.sendToServer(new ClarifyCardEvent({
            id:card.id,
            justification: ClarificationJustification.BROWNIE
        }));
    }

    visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, game.state], visualGame.elements.filter(element =>
            VisualCard.getExactVisualCard(element) && cards.some(card => (element as VisualCard).logicalCard.id === card.id)) as VisualCard[], (card)=>{
        const state = visualGame.state as VPickCardsState;
        state.cards.splice(state.cards.indexOf(card),1)[0]?.removeFromGame();

        const deck = sideTernary(card.getSide(), visualGame.deckA, visualGame.deckB);
        const toRemove =deck.getCards().find(cwr => cwr.card.logicalCard.id === card.logicalCard.id)?.card
        if(toRemove) {
            deck.removeCard(toRemove);
            toRemove.setRealPosition(card.position.clone());
            toRemove.setRealRotation(card.rotation.clone());
            toRemove.flipFaceup();
            sideTernary(card.getSide(), visualGame.handA, visualGame.handB).addCard(toRemove);
            network.sendToServer(new CardAction({
                cardId:toRemove.logicalCard.id,
                actionName: CardActionOptions.BROWNIE_DRAW,
                cardData: {
                    id:toRemove.logicalCard.id
                },
            }));
        }

        state.cancel();
    }, EndType.NONE), game.state);
});
wrap(cards["og-009"]!, CardActionType.PLACED, (orig, {self, game}) =>{
    if(orig) orig({self, game});

    const target=sideTernary(self.side, game.fieldsB, game.fieldsA).filter(card => card !== undefined);
    if(target.length>=2 &&//if there are at least 2 cards on opponent field
        target.some(card => //and at least one card has at least 1 stat less than 2
            ((card.cardData.stat(Stat.RED)??99)<2 || (card.cardData.stat(Stat.BLUE)??99)<2 || (card.cardData.stat(Stat.YELLOW)??99)<2))) {

        visualGame.setState(new VPickCardsState(visualGame, [visualGame.state, visualGame.getGame().state],
            visualGame.elements.filter(element => VisualCard.getExactVisualCard(element) &&
                (((element as VisualCard).logicalCard.cardData.stat(Stat.RED)??99)<2||
                    ((element as VisualCard).logicalCard.cardData.stat(Stat.BLUE)??99)<2||
                    ((element as VisualCard).logicalCard.cardData.stat(Stat.YELLOW)??99)<2)) as VisualCard[],
            (card) => {
                network.sendToServer(new CardAction({cardId:-1, actionName:CardActionOptions.GREMLIN_SCARE, cardData:{
                    id:card.logicalCard.id,
                }}));
            }, EndType.CANCEL, ()=>{
                network.sendToServer(new CardAction({cardId:-1, actionName:CardActionOptions.GREMLIN_CANCEL, cardData:{}}));
            }), visualGame.getGame().state);
    }
});
