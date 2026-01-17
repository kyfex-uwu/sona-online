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
    type BROWNIE_DRAW, type BROY_WEASLA_INCREASE,
    type CardActionOption,
    CardActionOptions,
    type CLOUD_CAT_PICK,
    type COWGIRL_COYOTE_INCREASE,
    type DCW_PICK,
    type DCW_SCARE,
    type FOXY_MAGICIAN_PICK,
    type FURMAKER_PICK,
    type GREMLIN_SCARE,
    type K9_ALPHA,
    type KIBBY_SCARE,
    type LITTLEBOSS_IMMUNITY, type SONIC_STALLION_SAVE,
    type WORICK_RESCUE,
    type YASHI_REORDER
} from "./CardActionOption.js";
import {other, Side} from "../GameElement.js";
import {BeforeGameState, TurnState} from "../GameStates.js";
import {Species} from "../CardData.js";
import Card, {CardMiscDataStrings} from "../Card.js";
import Game, {GameMiscDataStrings} from "../Game.js";
import {sideTernary} from "../consts.js";
import {
    acceptEvent,
    parseEvent,
    type processedEvent,
    rejectEvent,
    scareInterrupt,
    sendToClients
} from "./BackendServer.js";

function defaultIsValid<T extends SerializableType>(event:CardAction<T>, cardName:string, optData:{
    cardActionOption?: CardActionOption<any>,
    lastAction?:boolean
}){
    const actor = verifyFieldCard(event);
    const data = event.data.cardData;

    // console.log(actor !== undefined ,//actor exists
    //     event.game !== undefined , //game exists
    //     actor!.cardData.name === cardName , //card is cardData
    //     event.game!.state instanceof TurnState , //state is turnState
    //     event.game!.state.turn === actor!.side , //player's turn
    //     event.game!.state.actionsLeft === 1 , //last action
    //     (optData.cardActionOption === undefined ?
    //         event.game!.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor!.side]) === optData.cardActionOption : "") ,//card action option matches
    //     event.game!.player(actor!.side) === event.sender)
    if(!(actor !== undefined &&//actor exists
        event.game !== undefined && //game exists
        actor.cardData.name === cardName && //card is cardData
        event.game.state instanceof TurnState && //state is turnState
        event.game.state.turn === actor.side && //player's turn
        (!(optData.lastAction??false) || event.game.state.actionsLeft === 1) && //last action
        (optData.cardActionOption === undefined ||
            event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === optData.cardActionOption) &&//card action option matches
        event.game.player(actor.side) === event.sender)) //card is sender's
        return false;
    return {actor:actor!, data, valid:true};
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
function verifyFieldCard(event:CardAction<any>){
    return (event.game === undefined ? undefined :
        (event.sender === event.game.player(Side.A) ? event.game.fieldsA : event.game.fieldsB)
            .find(card => card?.id === event.data.cardId));
}

export default function(event:CardAction<any>):processedEvent{
    if(event.game === undefined) return rejectEvent(event, "no game");
    switch(event.data.actionName){
        case CardActionOptions.K9_ALPHA:{//og-001
            const data = (event as CardAction<K9_ALPHA>).data.cardData;
            const sender = verifyFieldCard(event);
            const takeFrom = [...(event.sender === event.game.player(Side.A) ? event.game.fieldsA : event.game.fieldsB)]
                .filter((_,i)=>data.canineFields[i]);

            if(!(event.game.state instanceof TurnState && event.game.player(event.game.state.turn) === event.sender &&//its the senders turn
                sender !== undefined && sender!.cardData.name === "og-001" &&//atttacking card is k9
                takeFrom.map(card=>card?.cardData.species === Species.CANINE)//all cards are canines
                    .reduce((a,c)=>a&&c)))
                return rejectEvent(event, "failed k9 check");

            const stat = data.canineFields.map((v,i)=>v?
                (takeFrom[i]?.stat(data.attackWith)??0):0).reduce((a, b)=>a+b,0);

            const toAttack = (event.sender === event.game.player(Side.A) ? event.game.fieldsB : event.game.fieldsA)[data.attack-1];
            if(toAttack === undefined) return rejectEvent(event, "k9 no card found");

            sender.setMiscData(CardMiscDataStrings.K9_TEMP_STAT_UPGRADE, {stat: data.attackWith, newVal: stat});
            parseEvent(new ScareAction({
                scarerPos:[(takeFrom.findIndex(card=>card?.id === sender.id)+1) as 1|2|3, sender.side],
                scaredPos:[data.attack, event.sender === event.game.player(Side.A) ? Side.B : Side.A],
                attackingWith:data.attackWith,
            }, event.game, event.sender, event.id));
            sender.setMiscData(CardMiscDataStrings.K9_TEMP_STAT_UPGRADE, undefined);
            return acceptEvent(event);
        }
        case CardActionOptions.BROWNIE_DRAW: {//og-005
            const id = (event as CardAction<BROWNIE_DRAW>).data.cardData.id;
            const card = event.game.cards.values().find(card => card.id === id);

            if (!(card && event.game.player(card.side) === event.sender &&//card exists and card belongs to sender
                card.cardData.level === 1 && card.isAlwaysFree() &&//and card is level 1 and card is free
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[card.side]) === CardActionOptions.BROWNIE_DRAW))//the sender needs to brownie draw
                return rejectEvent(event, "failed brownie check");

            findAndRemove(event.game, card);
            sideTernary(card.side, event.game.handA, event.game.handB).push(card);

            sendToClients(new CardAction({
                cardId: -1,
                actionName:CardActionOptions.BROWNIE_DRAW,
                cardData:{id:card.id},
            }, event.game), event.sender);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[card.side], undefined);
            event.game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
            return acceptEvent(event);
        }
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

                parseEvent(new ScareAction({
                    scaredPos:[data.position, event.sender === event.game.player(Side.A)?Side.B:Side.A],
                    scarerPos:[((event.sender === event.game.player(Side.A)?event.game.fieldsA:event.game.fieldsB).indexOf(actor) +1) as 1|2|3,
                        event.sender === event.game.player(Side.A)?Side.A:Side.B],
                    attackingWith:"card",
                    failed:false,
                }, event.game).force().forceFree());
                return acceptEvent(event);
            }
        }
        case CardActionOptions.AMBER_PICK:{//og-018
            const succeeded = defaultIsValid<AMBER_PICK>(event, "og-018", {
                cardActionOption:CardActionOptions.AMBER_PICK
            });
            if(succeeded === false) return rejectEvent(event, "failed amber check");
            const {actor, data} = succeeded;

            const toReorder = sideTernary(actor.side, event.game.deckA, event.game.deckB);
            let [card1, card2] = [toReorder.pop(), toReorder.pop()];
            if(data!.which === AmberData.KEEP_SECOND) [card1, card2] = [card2, card1];
            if(card1 !== undefined) {
                sideTernary(actor.side, event.game.handA, event.game.handB).push(card1);
                sendToClients(new ClarifyCardEvent({
                    id:card1.id,
                    cardDataName:card1.cardData.name,
                }, event.game));
            }
            if(card2 !== undefined) {
                sideTernary(actor.side, event.game.runawayA, event.game.runawayB).push(card2);
                sendToClients(new ClarifyCardEvent({
                    id:card2.id,
                    cardDataName:card2.cardData.name,
                }, event.game));
            }

            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor!.side], undefined);

            sendToClients(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.AMBER_PICK,
                cardData: {
                    which:data!.which,
                    side:actor!.side
                },
            }, event.game));
            return acceptEvent(event);
        }
        case CardActionOptions.YASHI_REORDER:{//og-027
            const actor = verifyFieldCard(event);
            const data = (event as CardAction<YASHI_REORDER>).data.cardData;

            if(!(actor !== undefined && actor.cardData.name === "og-027" &&//card exists and is yashi
                event.game.state instanceof TurnState && event.game.state.turn === actor.side &&//it is the actor's turn
                event.game.player(actor.side) === event.sender &&//actor belongs to sender

                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.YASHI_REORDER
            ))
                return rejectEvent(event, "failed yashi check");

            const deckDrawFrom = sideTernary(actor.side, event.game.deckA, event.game.deckB);
            for(let i=data.cards.length-1;i>=0;i--){
                const index = deckDrawFrom.findIndex(card=>card.id === data.cards[i]);
                if(index===-1) return rejectEvent(event, "failed yashi check card #"+i);

                deckDrawFrom.push(deckDrawFrom.splice(index,1)[0]!);
            }

            sendToClients(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.YASHI_REORDER,
                cardData:{
                    cards:data.cards,
                    side:actor.side
                }
            }, event.game));

            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            return acceptEvent(event);
        }
        case CardActionOptions.KIBBY_SCARE:{//og-028
            const succeeded = defaultIsValid<KIBBY_SCARE>(event, "og-028", {lastAction:true});
            if(!succeeded) return rejectEvent(event, "failed default kibby otes check");
            const {actor, data} = succeeded;

            if(actor.hasAttacked) return rejectEvent(event, "failed special kibby otes check");
            const fields = sideTernary(actor.side, event.game.fieldsA, event.game.fieldsB);
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
                }, event.game, event.sender).force());
            }
            for(let i=0;i<3;i++){
                if(data.cards[i] === false) continue;

                parseEvent(new PlaceAction({
                    cardId:data.cards[i] as number,
                    position:(i+1) as 1|2|3,
                    side:actor.side,
                    faceUp:true,
                }, event.game).force().forceFree());
            }
            return acceptEvent(event);
        }
        case CardActionOptions.FOXY_MAGICIAN_PICK:{//og-031
            const actor = verifyFieldCard(event);
            if(!(actor !== undefined &&//actor exists
                event.game !== undefined && //game exists
                actor.cardData.name === "og-031" && //card is cardData
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) ===
                    CardActionOptions.FOXY_MAGICIAN_PICK&&//card action option matches
                event.game.player(actor.side) === event.sender)) //card is sender's
                return rejectEvent(event, "failed default foxy check");

            const data = (event as CardAction<FOXY_MAGICIAN_PICK>).data.cardData;

            if(!sideTernary(actor.side, event.game.deckA, event.game.deckB).some(card=>card.id === data))
                rejectEvent(event, "invalid level foxy");

            event.game.setMiscData(GameMiscDataStrings.FOXY_MAGICIAN_PICKED, data);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], CardActionOptions.CANNOT_PLAY);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[other(actor.side)], CardActionOptions.FOXY_MAGICIAN_GUESS);
            event.game.player(other(actor.side))?.send(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.FOXY_MAGICIAN_GUESS,
                cardData:1
            }));
            return acceptEvent(event);
        }
        case CardActionOptions.DCW_PICK:{//og-032
            const actor = verifyFieldCard(event);
            if(!(actor !== undefined &&//actor exists
                event.game !== undefined && //game exists
                actor.cardData.name === "og-032" && //card is cardData
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) ===
                CardActionOptions.DCW_PICK&&//card action option matches
                event.game.player(actor.side) === event.sender)) //card is sender's
                return rejectEvent(event, "failed default dcw check");

            const data = (event as CardAction<DCW_PICK>).data.cardData;

            if(!sideTernary(actor.side, event.game.deckA, event.game.deckB).some(card=>card.id === data))
                rejectEvent(event, "invalid level dcw");

            event.game.setMiscData(GameMiscDataStrings.DCW_PICKED, {cardId:data,guesses:0});
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], CardActionOptions.CANNOT_PLAY);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[other(actor.side)], CardActionOptions.DCW_GUESS);
            event.game.player(other(actor.side))?.send(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.DCW_GUESS,
                cardData:1
            }));
            return acceptEvent(event);
        }
        case CardActionOptions.FOXY_MAGICIAN_GUESS:{
            const guesserSide = event.sender === event.game.player(Side.A) ? Side.A : Side.B;
            if(event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
                [guesserSide]) !== CardActionOptions.FOXY_MAGICIAN_GUESS) //card is sender's
                return rejectEvent(event, "failed foxy guess check");

            const toDraw = sideTernary(guesserSide, event.game.deckB, event.game.deckA)
                .find(card=>card.id === event.game!.getMiscData(GameMiscDataStrings.FOXY_MAGICIAN_PICKED))!;

            if(toDraw.cardData.level !== (event as CardAction<FOXY_MAGICIAN_PICK>).data.cardData){
                sendToClients(new ClarifyCardEvent({
                    id: toDraw.id,
                    cardDataName: toDraw.cardData.name,
                    justification:ClarificationJustification.FOXY_MAGICIAN
                }, event.game));
                sideTernary(guesserSide, event.game.handB, event.game.handA).push(toDraw);
            }else{
                sendToClients(new ClarifyCardEvent({
                    id: toDraw.id,
                    cardDataName: "",
                    justification:ClarificationJustification.FOXY_MAGICIAN
                }, event.game));
            }
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[Side.A], undefined);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[Side.B], undefined);
            event.game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.DCW_GUESS:{
            const guesserSide = event.sender === event.game.player(Side.A) ? Side.A : Side.B;
            if(event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
                [guesserSide]) !== CardActionOptions.DCW_GUESS) //card is sender's
                return rejectEvent(event, "failed dcw guess check");

            const pickedData = event.game.getMiscData(GameMiscDataStrings.DCW_PICKED);
            if(pickedData === undefined) return rejectEvent(event, "dcw: this is so sad. what");

            const toDraw = sideTernary(guesserSide, event.game.deckB, event.game.deckA)
                .find(card=>card.id === pickedData.cardId)!;

            let failed=false;
            if(toDraw.cardData.level === (event as CardAction<DCW_PICK>).data.cardData){
                pickedData.guesses=1;//skip straight to the end
            }else if(pickedData.guesses === 1){//does this have the potential to not trigger if 2 packets are sent in quick succession?
                failed=true;
            }
            pickedData.guesses++;
            if(pickedData.guesses >=2){
                event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[guesserSide], undefined);
                sendToClients(new ClarifyCardEvent({
                    id: failed ? -1 : toDraw.id,
                    cardDataName: toDraw.cardData.name,
                    justification:ClarificationJustification.DCW
                }, event.game));
                event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[other(guesserSide)],
                    failed?CardActionOptions.DCW_SCARE:undefined);
                if(!failed) event.game.unfreeze();
            }else{
                event.game.player(guesserSide)?.send(new ClarifyCardEvent({
                    id:-1,
                    cardDataName:"",
                    justification:ClarificationJustification.DCW
                }));
            }
            return acceptEvent(event);
        }
        case CardActionOptions.DCW_SCARE:{
            const actor = verifyFieldCard(event);
            if(actor===undefined || event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !==
                CardActionOptions.DCW_SCARE) return rejectEvent(event, "not time for that buddy dcw");

            const data = (event as CardAction<DCW_SCARE>).data.cardData;
            parseEvent(new ScareAction({
                scarerPos:[(sideTernary(actor.side, event.game.fieldsA, event.game.fieldsB).indexOf(actor)+1) as 1|2|3, actor.side],
                scaredPos:[data.pos, data.side],
                attackingWith:"card",
                failed:false
                //note: the freeze filter is specifically letting through forced scares without senders.
                //if you need to add a sender to this event in the future make sure to modify the freeze filter as well
            }, event.game).force().forceFree());
            event.game.unfreeze();
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            return acceptEvent(event);
        }
        case CardActionOptions.WORICK_RESCUE:{//og-038
            const succeeded = defaultIsValid<WORICK_RESCUE>(event, "og-038", {lastAction:true});
            if(!succeeded) return rejectEvent(event, "failed default worick check");
            const {actor, data} = succeeded;

            const toRemove = sideTernary(actor!.side, event.game.runawayA, event.game.runawayB)
                .findIndex(card=>card.id === data.id);
            if(toRemove === -1) return rejectEvent(event, "failed special worick check");

            sideTernary(actor!.side, event.game.handA, event.game.handB).push(
                sideTernary(actor!.side, event.game.runawayA, event.game.runawayB).splice(toRemove,1)[0]!);

            sendToClients(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.WORICK_RESCUE,
                cardData:{
                    id:data.id,
                    side:actor.side
                }
            }, event.game));
            return acceptEvent(event);
        }
        case CardActionOptions.FURMAKER_PICK:{//og-041
            const succeeded = defaultIsValid<FURMAKER_PICK>(event, "og-041", {lastAction:false});
            if(!succeeded) return rejectEvent(event, "failed default furmaker check");
            const {actor, data} = succeeded;

            const toRemove = sideTernary(actor!.side, event.game.deckA, event.game.deckB)
                .findIndex(card=>card.id === data.id);
            if(toRemove === -1) return rejectEvent(event, "failed special furmaker check");

            sideTernary(actor!.side, event.game.handA, event.game.handB).push(
                sideTernary(actor!.side, event.game.deckA, event.game.deckB).splice(toRemove,1)[0]!);

            sendToClients(new CardAction({
                cardId:-1,
                actionName:CardActionOptions.FURMAKER_PICK,
                cardData:{
                    id:data.id,
                    side:actor.side
                }
            }, event.game));
            return acceptEvent(event);
        }
        case CardActionOptions.CLOUD_CAT_PICK: {//og-043
            const actor = verifyFieldCard(event);
            const pos = (event as CardAction<CLOUD_CAT_PICK>).data.cardData;

            if(!(actor !== undefined && actor.cardData.name === "og-043" &&//card exists and is cloud cat
                ((event.game.state instanceof TurnState && event.game.state.turn === actor.side) ||//it is the actor's turn
                event.game.state instanceof BeforeGameState) &&//it is the first place
                event.game.player(actor.side) === event.sender &&//actor belongs to sender

                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) === CardActionOptions.CLOUD_CAT_PICK &&//next action
                (sideTernary(actor.side, event.game.fieldsB, event.game.fieldsA)[pos-1] !== undefined ||//targeted card exists OR
                    event.game.state instanceof BeforeGameState)//its before the first turn
            ))
                return rejectEvent(event, "failed cloud cat check");

            event.game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![other(actor.side)] =
                event.game.state instanceof BeforeGameState ? "first" : pos;
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            sendToClients(event, event.sender);
            return acceptEvent(event);
        }
        case CardActionOptions.LITTLEBOSS_IMMUNITY:{//og-015
            const actor = (event.game.player(Side.A) === event.sender ?
                event.game.fieldsA : event.game.fieldsB).find(card=>
                    card !== undefined &&
                    card.getMiscData(CardMiscDataStrings.PAUSED_SCARE) !== undefined &&
                    card.cardData.name === "og-015");
            const data = (event as CardAction<LITTLEBOSS_IMMUNITY>).data.cardData;

            if(actor === undefined || event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !==
                CardActionOptions.LITTLEBOSS_IMMUNITY)
                return rejectEvent(event, "failed littleboss check");

            actor.setMiscData(CardMiscDataStrings.LITTLEBOSS_IMMUNE, data);

            const scareNext = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            if(scareNext) scareNext();

            event.game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.COWGIRL_COYOTE_INCREASE:{//og-035
            const actor = (event.game.player(Side.A) === event.sender ?
                event.game.fieldsA : event.game.fieldsB).find(card=>
                card !== undefined &&
                card.getMiscData(CardMiscDataStrings.PAUSED_SCARE) !== undefined &&
                card.cardData.name === "og-035");

            if(actor === undefined ||
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !== CardActionOptions.COWGIRL_COYOTE_INCREASE ||
                actor.getMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET) === undefined ||
                actor.getMiscData(CardMiscDataStrings.ALREADY_ATTACKED) === true)
                return rejectEvent(event, "failed cowgirl check");

            const data = (event as CardAction<COWGIRL_COYOTE_INCREASE>).data.cardData;
            const target = actor.getMiscData(CardMiscDataStrings.COWGIRL_COYOTE_TARGET)!;
            //do stuff
            if(data !== false){
                actor.setMiscData(CardMiscDataStrings.ALREADY_ATTACKED, true);
                if(target.stat(data) === undefined)
                    return rejectEvent(event, "failed cowgirl: stat is undefined");

                let toSet:[number,number,number] = [0,0,0];
                toSet[data] = 2;
                target.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)![actor.cardData.name+actor.cardData.id] = toSet;
            }

            const scareNext = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            if(scareNext) scareNext();

            event.game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.BROY_WEASLA_INCREASE:{//og-029
            const actor = (event.game.player(Side.A) === event.sender ?
                event.game.fieldsA : event.game.fieldsB).find(card=>
                card !== undefined &&
                card.getMiscData(CardMiscDataStrings.PAUSED_SCARE) !== undefined &&
                card.cardData.name === "og-029");

            if(actor === undefined ||
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !== CardActionOptions.BROY_WEASLA_INCREASE)
                return rejectEvent(event, "failed broy weasla check");

            const data = (event as CardAction<BROY_WEASLA_INCREASE>).data.cardData;
            //do stuff
            if(data !== false){
                const target = sideTernary(data.pos[1], event.game.fieldsA, event.game.fieldsB)[data.pos[0]-1];
                if(target === undefined) return rejectEvent(event, "broy weasla: tried to change nonexistent card");

                if(target.stat(data.stat) === undefined)
                    return rejectEvent(event, "failed broy weasla: stat is undefined");

                let toSet:[number,number,number] = [0,0,0];
                toSet[data.stat] = 2;
                target.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)![actor.cardData.name+actor.cardData.id] = toSet;

                actor.setMiscData(CardMiscDataStrings.BROY_WEASLA_TARGET, target);
            }

            const scareNext = actor.getMiscData(CardMiscDataStrings.PAUSED_SCARE);
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            actor.setMiscData(CardMiscDataStrings.PAUSED_SCARE, undefined);
            if(scareNext) scareNext();

            event.game.unfreeze();
            return acceptEvent(event);
        }
        case CardActionOptions.SONIC_STALLION_SAVE:{
            const actor = (event.game.player(Side.A) === event.sender ?
                event.game.handA : event.game.handB).find(card=> card.cardData.name === "og-014");

            if(actor === undefined ||
                event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side]) !== CardActionOptions.SONIC_STALLION_SAVE)
                return rejectEvent(event, "failed sonic check");

            const data = (event as CardAction<SONIC_STALLION_SAVE>).data.cardData;
            event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[actor.side], undefined);
            if(data !== false){
                parseEvent(new PlaceAction({
                    cardId:actor.id,
                    position:data,
                    side:actor.side,
                    faceUp:true
                }, event.game).force().forceFree());
                sendToClients(new CardAction({
                    cardId:-1,
                    actionName:CardActionOptions.SONIC_STALLION_SAVE,
                    cardData:1
                }, event.game));
            }

            event.game.unfreeze();
            return acceptEvent(event);
        }
    }

    return rejectEvent(event, "not a recognized action");
}
