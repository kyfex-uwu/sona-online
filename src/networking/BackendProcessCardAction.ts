import {CardAction, ScareAction} from "./Events.js";
import {
    type BROWNIE_DRAW,
    CardActionOptions,
    type GREMLIN_SCARE,
    type K9_ALPHA,
    type YASHI_REORDER
} from "./CardActionOption.js";
import {Side} from "../GameElement.js";
import {TurnState} from "../GameStates.js";
import {CardActionType, Species} from "../CardData.js";
import Card, {MiscDataStrings} from "../Card.js";
import Game, {GameMiscDataStrings} from "../Game.js";
import {sideTernary} from "../consts.js";
import {acceptEvent, parseEvent, rejectEvent, scareInterrupt, usersFromGameIDs} from "./BackendServer.js";


function findAndRemove(game:Game, card:Card){
    for(const group of [game.deckA, game.deckB, game.runawayA, game.runawayB, game.handA, game.handB]) {
        for (let i = 0; i < group.length; i++) {
            if (group[i] === card) {
                group.splice(i, 1);
                break;
            }
        }
    }
    for(const fields of [game.fieldsA, game.fieldsB]){
        for (let i = 0; i < fields.length; i++) {
            if (fields[i] === card) {
                fields[i]=undefined;
            }
        }
    }
}

/**
 * Verifies that the card at `event.data.cardId` actually exists in that player's fields
 * verifies:
 *  - game exists
 *  - some field on the sender's side has an id that matches
 * @param event The CardAction to check
 * @return the card found, if there is any
 */
function verifyFieldCard(event:CardAction<any>){
    return (event.game === undefined ? undefined :
        (event.sender === event.game.player(Side.A) ? event.game.fieldsA : event.game.fieldsB)
            .find(card => card?.id === event.data.cardId));
}

export default function(event:CardAction<any>){
    if(event.game === undefined) return;
    switch(event.data.actionName){
        case CardActionOptions.K9_ALPHA:{//og-001
            verifyFieldCard(event);
            const data = (event as CardAction<K9_ALPHA>).data.cardData;
            const sender = event.game.cards.values().find(card => card.id === event.data.cardId);
            const takeFrom = [...(event.sender === event.game.player(Side.A) ? event.game.fieldsA : event.game.fieldsB)];

            if(!(event.game.state instanceof TurnState && event.game.player(event.game.state.turn) === event.sender )||//its the senders turn
                sender === undefined || sender!.cardData.name === "og-001" ||//atttacking card is k9
                !takeFrom.map(card=>card?.cardData.species === Species.CANINE)//NOT(all cards are canines)
                    .reduce((a,c)=>a&&c))
                return rejectEvent(event, "failed k9 check");

            const stat = data.canineFields.map((v,i)=>v?
                (takeFrom[i]?.cardData.stat(data.attackWith)??0):0).reduce((a, b)=>a+b,0);

            const toAttack = (event.sender === event.game.player(Side.A) ? event.game.fieldsB : event.game.fieldsA)[data.attack-1];
            if(toAttack !== undefined){
                sender.setMiscData(MiscDataStrings.K9_TEMP_STAT_UPGRADE, {stat: data.attackWith, newVal: stat});
                parseEvent(new ScareAction({//todo
                    scarerPos:[takeFrom.findIndex(card=>card?.id === sender.id) as 1|2|3, sender.side],
                    scaredPos:[data.attack, event.sender === event.game.player(Side.A) ? Side.B : Side.A],
                    attackingWith:data.attackWith,
                }, event.game, event.sender, event.id));
                sender.setMiscData(MiscDataStrings.K9_TEMP_STAT_UPGRADE, undefined);
            }
        }break;
        case CardActionOptions.BROWNIE_DRAW: {//og-005
            const id = (event as CardAction<BROWNIE_DRAW>).data.cardData.id;
            const card = event.game.cards.values().find(card => card.id === id);

            if (card && event.game.player(card.side) === event.sender &&//card exists and card belongs to sender
                card.cardData.level === 1 && card.cardData.getAction(CardActionType.IS_FREE)&&//and card is level 1 and card is free
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[card.side]) === CardActionOptions.BROWNIE_DRAW){//the sender needs to brownie draw
                findAndRemove(event.game, card);
                sideTernary(card.side, event.game.handA, event.game.handB).push(card);

                for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                    if(user !== event.sender){
                        user.send(new CardAction({
                            cardId: -1,
                            actionName:CardActionOptions.BROWNIE_DRAW,
                            cardData:{id:card.id},
                        }))
                    }
                }
                event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[card.side], undefined);
                event.game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
                acceptEvent(event);
            }else{
                rejectEvent(event, "failed brownie check");
            }
        }break;
        case CardActionOptions.GREMLIN_SCARE:{//og-009
            const actor = verifyFieldCard(event);
            const data = (event as CardAction<GREMLIN_SCARE>).data.cardData;
            if(!(actor !== undefined && actor.cardData.name === "og-009" &&//card exists and is gremlin
                event.game.state instanceof TurnState && event.game.state.turn === actor.side &&//it is the actor's turn
                event.game.player(actor.side) === event.sender &&//actor belongs to sender
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.GREMLIN_SCARE//sender is allowed to scare
            ))
                return rejectEvent(event, "failed gremlin check");

            if(data.position === undefined){
                event.game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
                return acceptEvent(event);
            }else{
                const scared = (event.sender === event.game.player(Side.A)?event.game.fieldsB:event.game.fieldsA)[data.position-1];
                if(scared === undefined) return rejectEvent(event, "gremlin scare card doesnt exist");

                const toSend = new ScareAction({
                    scaredPos:[data.position, event.sender === event.game.player(Side.A)?Side.B:Side.A],
                    scarerPos:[((event.sender === event.game.player(Side.A)?event.game.fieldsA:event.game.fieldsB).indexOf(actor) +1) as 1|2|3,
                        event.sender === event.game.player(Side.A)?Side.A:Side.B],
                    attackingWith:"card",
                    failed:false,
                }, event.game);
                scareInterrupt(toSend, toSend.game!, actor, scared, toSend.data.attackingWith, ()=>{
                    sideTernary(toSend.data.scarerPos[1], toSend.game!.fieldsA, toSend.game!.fieldsB)[toSend.data.scarerPos[1]-1]!.hasAttacked=true;
                    sideTernary(toSend.data.scaredPos[1], toSend.game!.fieldsA, toSend.game!.fieldsB)[toSend.data.scaredPos[1]-1]=undefined;

                    for(const user of (usersFromGameIDs[event.game!.gameID]||[])){
                        user.send(toSend);
                    }

                    event.game!.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
                    scared.cardData.callAction(CardActionType.AFTER_SCARED, {
                        self:sideTernary(toSend.data.scaredPos[1], toSend.game!.fieldsA, toSend.game!.fieldsB)[toSend.data.scaredPos[0]-1],
                        scarer:sideTernary(toSend.data.scarerPos[1], toSend.game!.fieldsA, toSend.game!.fieldsB)[toSend.data.scarerPos[0]-1],
                        game:event.game!, stat:toSend.data.attackingWith});
                });
            }

        }break;
        case CardActionOptions.YASHI_REORDER:{//og-027
            const actor = verifyFieldCard(event);
            const cards = (event as CardAction<YASHI_REORDER>).data.cardData;

            if(!(actor !== undefined && actor.cardData.name === "og-027" &&//card exists and is yashi
                event.game.state instanceof TurnState && event.game.state.turn === actor.side &&//it is the actor's turn
                event.game.player(actor.side) === event.sender &&//actor belongs to sender

                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.YASHI_REORDER
            ))
                return rejectEvent(event, "failed yashi check");

            const deckDrawFrom = sideTernary(actor.side, event.game.deckA, event.game.deckB);
            for(let i=cards.length-1;i>=0;i--){
                const index = deckDrawFrom.findIndex(card=>card.id === cards[i]);
                if(index===-1) return rejectEvent(event, "failed yashi check card #"+i);

                deckDrawFrom.push(deckDrawFrom.splice(index,1)[0]!);
            }

            //todo:send to clients

            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            acceptEvent(event);
        }break;
    }
}
