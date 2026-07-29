import {
    CardAction,
    ClarificationJustification,
    ClarifyCardEvent,
    PlaceAction,
    ScareAction,
    type SerializableType
} from "./Events.js";
import {
    type AMBER_PICK,
    AmberData,
    type BROWNIE_DRAW,
    type BROY_WEASLA_INCREASE,
    type CardActionOption,
    CardActionOptions,
    type CLOUD_CAT_PICK,
    type COWGIRL_COYOTE_INCREASE,
    type DCW_PICK,
    type DCW_SCARE,
    type FOXY_MAGICIAN_GUESS,
    type FOXY_MAGICIAN_PICK,
    type FURMAKER_PICK,
    type GREMLIN_SCARE,
    type K9_ALPHA,
    type KIBBY_SCARE,
    type LITTLEBOSS_IMMUNITY,
    type NOBLE_RETARGET,
    type WORICK_RESCUE,
    type YASHI_REORDER
} from "./CardActionOption.js";
import {other, Side} from "../GameElement.js";
import {BeforeGameState, TurnState} from "../GameStates.js";
import {Species} from "../CardData.js";
import Card, {CardMiscDataStrings} from "../Card.js";
import Game, {GameMiscDataStrings} from "../Game.js";
import {sideTernary} from "../consts.js";
import {parseEvent, sendToGame, shuffleBackend} from "./BackendGameServer.js";
import {acceptEvent, type processedEvent, rejectEvent} from "./BackendServer.js";

function lastAction(game:Game){
    const state = game.state;
    if(state instanceof TurnState) state.actionsLeft=-1;
}

function defaultIsValid<T extends SerializableType>(event:CardAction<T>, game:Game, cardName:string, optData:{
    cardActionOption?: CardActionOption<any>
}){
    const actor = verifyFieldCard(event, game);

    if(!(actor !== undefined &&//actor exists
        game !== undefined && //game exists
        actor.cardData.name === cardName && //card is cardData
        game.state instanceof TurnState && //state is turnState
        game.state.turn === actor.side && //player's turn
        game.state.actionsLeft > 0 &&
        (optData.cardActionOption === undefined ||
            game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === optData.cardActionOption) &&//card action option matches
        game.player(actor.side) === event.sender)) //card is sender's
        return false;
    return {actor:actor!, data:event.data.cardData};
}

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
function verifyFieldCard(event:CardAction<any>, game:Game){
    return (game === undefined ? undefined :
        (event.sender === game.player(Side.A) ? game.fieldsA : game.fieldsB)
            .find(card => card?.id === event.data.cardId));
}

export default function(event:CardAction<any>, game:Game):processedEvent{
    if(game === undefined) return rejectEvent(event, "no game");
    switch(event.data.actionName){
        case CardActionOptions.K9_ALPHA:{//og-001
            const succeeded = defaultIsValid<K9_ALPHA>(event, game, "og-001", {});
            if(!succeeded) return rejectEvent(event, "failed k9 check");
            const {actor:sender, data} = succeeded;

            const takeFrom = [...(event.sender === game.player(Side.A) ? game.fieldsA : game.fieldsB)]
                .filter((_,i)=>data.canineFields[i]);

            if(!(takeFrom.map(card=>card?.cardData.species === Species.CANINE)//all cards are canines
                    .reduce((a,c)=>a&&c, true)))
                return rejectEvent(event, "failed k9 check");

            const stat = data.canineFields.map((v,i)=>v?
                (takeFrom[i]?.stat(data.attackWith)??0):0).reduce((a, b)=>a+b,0);

            const toAttack = (event.sender === game.player(Side.A) ? game.fieldsB : game.fieldsA)[data.attack-1];
            if(toAttack === undefined) return rejectEvent(event, "k9 no card found");

            sender.setMiscData(CardMiscDataStrings.K9_TEMP_STAT_UPGRADE, {stat: data.attackWith, newVal: stat});
            parseEvent(new ScareAction({
                scarerPos:[(takeFrom.findIndex(card=>card?.id === sender.id)+1) as 1|2|3, sender.side],
                scaredPos:[data.attack, event.sender === game.player(Side.A) ? Side.B : Side.A],
                attackingWith:data.attackWith,
            }, event.sender, event.id));
            lastAction(game);
            sender.setMiscData(CardMiscDataStrings.K9_TEMP_STAT_UPGRADE, undefined);
            return acceptEvent(event);
        }
        case CardActionOptions.BROWNIE_DRAW: {//og-005
            const id = (event as CardAction<BROWNIE_DRAW>).data.cardData.id;
            const card = [...game.cards.values()].find(card => card.id === id);

            if (!(card && game.player(card.side) === event.sender &&//card exists and card belongs to sender
                card.cardData.level === 1 && card.isAlwaysFree() &&//and card is level 1 and card is free
                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[card.side]) === CardActionOptions.BROWNIE_DRAW))//the sender needs to brownie draw
                return rejectEvent(event, "failed brownie check");

            findAndRemove(game, card);
            sideTernary(card.side, game.handA, game.handB).push(card);

            sendToGame(new CardAction({
                cardId: -1,
                actionName:CardActionOptions.BROWNIE_DRAW,
                cardData:{id:card.id},
            }), game, event.sender);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[card.side], undefined);
            game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
            shuffleBackend(sideTernary(card.side, game.deckA, game.deckB));
            return acceptEvent(event);
        }
        case CardActionOptions.GREMLIN_SCARE:{//og-009
            const actor = verifyFieldCard(event, game);
            const data = (event as CardAction<GREMLIN_SCARE>).data.cardData;
            if(!(actor !== undefined && actor.cardData.name === "og-009" &&//card exists and is gremlin
                game.state instanceof TurnState && game.state.turn === actor.side &&//it is the actor's turn
                game.player(actor.side) === event.sender &&//actor belongs to sender
                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.GREMLIN_SCARE//sender is allowed to scare
            ))
                return rejectEvent(event, "failed gremlin check");

            if(data.position === undefined){
                game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
                return acceptEvent(event);
            }else{
                const scared = (event.sender === game.player(Side.A)?game.fieldsB:game.fieldsA)[data.position-1];
                if(scared === undefined) return rejectEvent(event, "gremlin scare card doesnt exist");

                parseEvent(new ScareAction({
                    scaredPos:[data.position, event.sender === game.player(Side.A)?Side.B:Side.A],
                    scarerPos:[((event.sender === game.player(Side.A)?game.fieldsA:game.fieldsB).indexOf(actor) +1) as 1|2|3,
                        event.sender === game.player(Side.A)?Side.A:Side.B],
                    attackingWith:"card",
                    failed:false,
                }).force().forceFree().withGame(game));
                return acceptEvent(event);
            }
        }
        case CardActionOptions.AMBER_PICK:{//og-018
            const succeeded = defaultIsValid<AMBER_PICK>(event, game, "og-018", {
                cardActionOption:CardActionOptions.AMBER_PICK
            });
            if(succeeded === false) return rejectEvent(event, "failed amber check");
            const {actor, data} = succeeded;

            const toReorder = sideTernary(actor.side, game.deckA, game.deckB);
            let [card1, card2] = [toReorder.pop(), toReorder.pop()];
            if(data!.which === AmberData.KEEP_SECOND) [card1, card2] = [card2, card1];
            if(card1 !== undefined) {
                sideTernary(actor.side, game.handA, game.handB).push(card1);
                sendToGame(new ClarifyCardEvent({
                    id:card1.id,
                    cardDataName:card1.cardData.name,
                }), game);
            }
            if(card2 !== undefined) {
                sideTernary(actor.side, game.runawayA, game.runawayB).push(card2);
                sendToGame(new ClarifyCardEvent({
                    id:card2.id,
                    cardDataName:card2.cardData.name,
                }), game);
            }

            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor!.side], undefined);

            sendToGame(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.AMBER_PICK,
                cardData: {
                    which:data!.which,
                    side:actor!.side
                },
            }), game);
            return acceptEvent(event);
        }
        case CardActionOptions.YASHI_REORDER:{//og-027
            const actor = verifyFieldCard(event, game);
            const data = (event as CardAction<YASHI_REORDER>).data.cardData;

            if(!(actor !== undefined && actor.cardData.name === "og-027" &&//card exists and is yashi
                game.state instanceof TurnState && game.state.turn === actor.side &&//it is the actor's turn
                game.player(actor.side) === event.sender &&//actor belongs to sender

                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.YASHI_REORDER
            ))
                return rejectEvent(event, "failed yashi check");

            const deckDrawFrom = sideTernary(actor.side, game.deckA, game.deckB);
            for(let i=data.cards.length-1;i>=0;i--){
                const index = deckDrawFrom.findIndex(card=>card.id === data.cards[i]);
                if(index===-1) return rejectEvent(event, "failed yashi check card #"+i);

                deckDrawFrom.push(deckDrawFrom.splice(index,1)[0]!);
            }

            sendToGame(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.YASHI_REORDER,
                cardData:{
                    cards:data.cards,
                    side:actor.side
                }
            }), game);

            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            return acceptEvent(event);
        }
        case CardActionOptions.KIBBY_SCARE:{//og-028
            const succeeded = defaultIsValid<KIBBY_SCARE>(event, game, "og-028", {});
            if(!succeeded) return rejectEvent(event, "failed default kibby otes check");
            const {actor, data} = succeeded;

            if(actor.hasAttacked) return rejectEvent(event, "failed special kibby otes check");
            const fields = sideTernary(actor.side, game.fieldsA, game.fieldsB);
            for(const card of fields.filter((card, i) => data.cards[i] !== false && card !== undefined)
                .sort((c1,c2)=> {return{//this sorting ensure kibby otes is scared last
                    [c1!.id]:1,
                    [c2!.id]:-1
                }[actor.id] ?? 0})){
                parseEvent(new ScareAction({
                    scarerPos:[(fields.indexOf(actor)+1) as 1|2|3, actor.side],
                    scaredPos:[(fields.indexOf(card)+1) as 1|2|3, actor.side],
                    attackingWith:"card",
                    failed:false,
                }, event.sender).force().withGame(game));

            }
            for(let i=0;i<3;i++){
                if(data.cards[i] === false) continue;

                parseEvent(new PlaceAction({
                    cardId:data.cards[i] as number,
                    position:(i+1) as 1|2|3,
                    side:actor.side,
                }).force().forceFree().withGame(game));
            }
            lastAction(game);
            return acceptEvent(event);
        }
        case CardActionOptions.FOXY_MAGICIAN_PICK:{//og-031
            const succeeded = defaultIsValid<FOXY_MAGICIAN_PICK>(event, game, "og-031",{
                cardActionOption:CardActionOptions.FOXY_MAGICIAN_PICK
            });
            if(!succeeded) return rejectEvent(event, "failed default foxy check");
            const {actor, data} = succeeded;

            if(!sideTernary(actor.side, game.deckA, game.deckB).some(card=>card.id === data))
                rejectEvent(event, "invalid target card foxy");

            game.setMiscData(GameMiscDataStrings.FOXY_MAGICIAN_PICKED, data);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], CardActionOptions.CANNOT_PLAY);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[other(actor.side)], CardActionOptions.FOXY_MAGICIAN_GUESS);
            game.player(other(actor.side))?.send(new CardAction({
                cardId:data,
                actionName:CardActionOptions.FOXY_MAGICIAN_GUESS,
                cardData:1
            }));
            return acceptEvent(event);
        }
        case CardActionOptions.FOXY_MAGICIAN_GUESS:{
            const guesserSide = event.sender === game.player(Side.A) ? Side.A : Side.B;
            if(game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
                [guesserSide]) !== CardActionOptions.FOXY_MAGICIAN_GUESS) //should be guessing
                return rejectEvent(event, "failed foxy guess check");

            const answer = sideTernary(guesserSide, game.deckB, game.deckA)
                .find(card=>card.id === game!.getMiscData(GameMiscDataStrings.FOXY_MAGICIAN_PICKED))!;
            const guess = (event as CardAction<FOXY_MAGICIAN_GUESS>).data.cardData;

            if(answer.cardData.level !== guess) {
                event.sender?.send(new ClarifyCardEvent({
                    id: answer.id,
                    cardDataName: answer.cardData.name,
                    justification: ClarificationJustification.FOXY_MAGICIAN
                }));

                sideTernary(guesserSide, game.handB, game.handA).push(answer);
            }

            sendToGame(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.FOXY_MAGICIAN_GUESS,
                cardData:guess
            }), game);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[Side.A], undefined);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[Side.B], undefined);
            game.unfreeze();
            shuffleBackend(sideTernary(guesserSide, game.deckB, game.deckA));
            return acceptEvent(event);
        }
        case CardActionOptions.DCW_PICK:{//og-032
            const succeeded = defaultIsValid<DCW_PICK>(event, game, "og-032",{
                cardActionOption:CardActionOptions.DCW_PICK
            });
            if(!succeeded) return rejectEvent(event, "failed default dcw check");
            const {actor, data} = succeeded;

            if(!sideTernary(actor.side, game.deckA, game.deckB).some(card=>card.id === data))
                rejectEvent(event, "invalid target card dcw");

            game.setMiscData(GameMiscDataStrings.DCW_PICKED, {cardId:data,guesses:0});
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], CardActionOptions.CANNOT_PLAY);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[other(actor.side)], CardActionOptions.DCW_GUESS);
            game.player(other(actor.side))?.send(new CardAction({
                cardId:data,
                actionName:CardActionOptions.DCW_GUESS,
                cardData:1
            }));
            return acceptEvent(event);
        }
        case CardActionOptions.DCW_GUESS:{
            const guesserSide = event.sender === game.player(Side.A) ? Side.A : Side.B;
            if(game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
                [guesserSide]) !== CardActionOptions.DCW_GUESS) //should be guessing
                return rejectEvent(event, "failed dcw guess check");

            const pickedData = game.getMiscData(GameMiscDataStrings.DCW_PICKED);
            if(pickedData === undefined) return rejectEvent(event, "dcw: this is so sad. what");

            const answer = sideTernary(guesserSide, game.deckB, game.deckA)
                .find(card=>card.id === pickedData.cardId)!;

            let failed=false;
            const guess = (event as CardAction<DCW_PICK>).data.cardData;
            if(answer.cardData.level === guess){
                pickedData.guesses=1;//skip straight to the end
            }else if(pickedData.guesses === 1){
                failed=true;
            }
            pickedData.guesses++;
            if(pickedData.guesses >= 2){
                game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[guesserSide], undefined);
                event.sender?.send(new ClarifyCardEvent({
                    id: answer.id,
                    cardDataName: answer.cardData.name,
                    justification: ClarificationJustification.FOXY_MAGICIAN
                }));
                game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[other(guesserSide)],
                    failed?CardActionOptions.DCW_SCARE:undefined);
                shuffleBackend(sideTernary(other(guesserSide), game.deckA, game.deckB));
                if(!failed) game.unfreeze();
            }
            sendToGame(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.DCW_GUESS,
                cardData:guess
            }), game);
            return acceptEvent(event);
        }
        case CardActionOptions.DCW_SCARE:{
            const actor = verifyFieldCard(event, game);
            if(actor===undefined || game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !==
                CardActionOptions.DCW_SCARE) return rejectEvent(event, "not time for that buddy dcw");

            const data = (event as CardAction<DCW_SCARE>).data.cardData;
            parseEvent(new ScareAction({
                scarerPos:[(sideTernary(actor.side, game.fieldsA, game.fieldsB).indexOf(actor)+1) as 1|2|3, actor.side],
                scaredPos:[data.pos, data.side],
                attackingWith:"card",
                failed:false
                //note: the freeze filter is specifically letting through forced scares without senders.
                //if you need to add a sender to this event in the future make sure to modify the freeze filter as well
            }).force().forceFree().withGame(game));
            game.unfreeze();
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            return acceptEvent(event);
        }
        case CardActionOptions.WORICK_RESCUE:{//og-038
            const succeeded = defaultIsValid<WORICK_RESCUE>(event, game, "og-038", {});
            if(!succeeded) return rejectEvent(event, "failed default worick check");
            const {actor, data} = succeeded;

            const toRemove = sideTernary(actor!.side, game.runawayA, game.runawayB)
                .findIndex(card=>card.id === data.id);
            if(toRemove === -1) return rejectEvent(event, "failed special worick check");

            sideTernary(actor!.side, game.handA, game.handB).push(
                sideTernary(actor!.side, game.runawayA, game.runawayB).splice(toRemove,1)[0]!);

            sendToGame(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.WORICK_RESCUE,
                cardData:{
                    id:data.id,
                    side:actor.side
                }
            }), game);
            lastAction(game);
            return acceptEvent(event);
        }
        case CardActionOptions.FURMAKER_PICK:{//og-041
            const succeeded = defaultIsValid<FURMAKER_PICK>(event, game, "og-041", {});
            if(!succeeded) return rejectEvent(event, "failed default furmaker check");
            const {actor, data} = succeeded;

            const toRemove = sideTernary(actor!.side, game.deckA, game.deckB)
                .findIndex(card=>card.id === data.id);
            if(toRemove === -1) return rejectEvent(event, "failed special furmaker check");

            sideTernary(actor!.side, game.handA, game.handB).push(
                sideTernary(actor!.side, game.deckA, game.deckB).splice(toRemove,1)[0]!);

            sendToGame(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.FURMAKER_PICK,
                cardData:{
                    id:data.id,
                    side:actor.side
                }
            }), game);
            shuffleBackend(sideTernary(actor.side, game.deckA, game.deckB));
            return acceptEvent(event);
        }
        case CardActionOptions.CLOUD_CAT_PICK: {//og-043
            const actor = verifyFieldCard(event, game);
            const pos = (event as CardAction<CLOUD_CAT_PICK>).data.cardData;

            if(!(actor !== undefined && actor.cardData.name === "og-043" &&//card exists and is cloud cat
                ((game.state instanceof TurnState && game.state.turn === actor.side) ||//it is the actor's turn
                game.state instanceof BeforeGameState) &&//it is the first place
                game.player(actor.side) === event.sender &&//actor belongs to sender

                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.CLOUD_CAT_PICK &&//next action
                (sideTernary(actor.side, game.fieldsB, game.fieldsA)[pos-1] !== undefined ||//targeted card exists OR
                    game.state instanceof BeforeGameState)//its before the first turn
            ))
                return rejectEvent(event, "failed cloud cat check");

            game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![other(actor.side)] =
                game.state instanceof BeforeGameState ? "first" : pos;
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            sendToGame(event, game, event.sender);
            return acceptEvent(event);
        }
        case CardActionOptions.LITTLEBOSS_IMMUNITY:{//og-015
            const actor = (game.player(Side.A) === event.sender ?
                game.fieldsA : game.fieldsB).find(card=>
                    card !== undefined &&
                    card.getMiscData(CardMiscDataStrings.PAUSED_SCARE) !== undefined &&
                    card.cardData.name === "og-015");
            const shouldSave = (event as CardAction<LITTLEBOSS_IMMUNITY>).data.cardData;

            if(actor === undefined || game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !==
                CardActionOptions.LITTLEBOSS_IMMUNITY)
                return rejectEvent(event, "failed littleboss check");

            actor.setMiscData(CardMiscDataStrings.LITTLEBOSS_IMMUNE, shouldSave);

            const scareNext = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            if(scareNext) scareNext(true);

            game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.COWGIRL_COYOTE_INCREASE:{//og-035
            const actor = (game.player(Side.A) === event.sender ?
                game.fieldsA : game.fieldsB).find(card=>
                card !== undefined &&
                card.getMiscData(CardMiscDataStrings.PAUSED_SCARE) !== undefined &&
                card.cardData.name === "og-035");

            if(actor === undefined ||
                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !== CardActionOptions.COWGIRL_COYOTE_INCREASE ||
                actor.getMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET) === undefined ||
                actor.getMiscData(CardMiscDataStrings.ALREADY_ACTIONED) === true)
                return rejectEvent(event, "failed cowgirl check");

            const data = (event as CardAction<COWGIRL_COYOTE_INCREASE>).data.cardData;
            //do stuff
            if(data !== false){
                const target = sideTernary(data.pos[1], game.fieldsA, game.fieldsB)[data.pos[0]-1];
                if(target === undefined) return rejectEvent(event, "cowgirl: tried to change nonexistent card");

                if(target.stat(data.stat) === undefined)
                    return rejectEvent(event, "failed cowgirl: stat is undefined");

                let toSet:[number,number,number] = [0,0,0];
                toSet[data.stat] = 2;
                target.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)![actor.cardData.name+actor.cardData.id] = toSet;

                actor.setMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET, target);
            }

            const scareNext = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            if(scareNext) scareNext(true);

            game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.BROY_WEASLA_INCREASE:{//og-029
            const actor = (game.player(Side.A) === event.sender ?
                game.fieldsA : game.fieldsB).find(card=>
                card !== undefined &&
                card.getMiscData(CardMiscDataStrings.PAUSED_SCARE) !== undefined &&
                card.cardData.name === "og-029");

            if(actor === undefined ||
                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !== CardActionOptions.BROY_WEASLA_INCREASE)
                return rejectEvent(event, "failed broy weasla check");

            const data = (event as CardAction<BROY_WEASLA_INCREASE>).data.cardData;
            //do stuff
            if(data !== false){
                const target = sideTernary(data.pos[1], game.fieldsA, game.fieldsB)[data.pos[0]-1];
                if(target === undefined) return rejectEvent(event, "broy weasla: tried to change nonexistent card");

                if(target.stat(data.stat) === undefined)
                    return rejectEvent(event, "failed broy weasla: stat is undefined");

                let toSet:[number,number,number] = [0,0,0];
                toSet[data.stat] = 2;
                target.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)![actor.cardData.name+actor.cardData.id] = toSet;

                actor.setMiscData(CardMiscDataStrings.BROY_WEASLA_TARGET, target);
            }

            const scareNext = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            if(scareNext) scareNext(true);

            game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.NOBLE_RETARGET:{
            const actor = (game.player(Side.A) === event.sender ?
                game.fieldsA : game.fieldsB).find(card=> card?.cardData.name === "og-020");

            if(actor === undefined ||
                game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !== CardActionOptions.NOBLE_RETARGET)
                return rejectEvent(event, "failed noble check");

            if((event as CardAction<NOBLE_RETARGET>).data.cardData){
                const origScare = actor.getMiscData(CardMiscDataStrings.NOBLE_ORIG_SCARE);
                if(origScare) origScare.data.scaredPos = [
                    (sideTernary(actor.side, game.fieldsA, game.fieldsB).findIndex(card=>card?.id === actor.id)+1) as 1|2|3,
                    actor.side
                ];
            }

            const next = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            if(next) next(true);
            actor.setMiscData(CardMiscDataStrings.NOBLE_ORIG_SCARE, undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            game.unfreeze();

            return acceptEvent(event);
        }
    }

    return rejectEvent(event, "not a recognized action");
}
