import {network} from "../Server.js";
import {
    ActionEvent,
    CardAction,
    ClarificationJustification,
    ClarifyCardEvent,
    DetermineStarterEvent,
    DiscardAction,
    DrawAction,
    GameEvent,
    GameStartEvent,
    GameStartEventWatcher,
    GameWinDefaultEvent,
    InternalStartGameEvent,
    multiClarifyFactory,
    PassAction,
    PerchanceEvent,
    PlaceAction,
    RequestServerDumpAction,
    ScareAction,
    ServerDumpEvent,
    StartRequestEvent
} from "../Events.js";
import Game, {GameMiscDataStrings} from "../../Game.js";
import {other, Side} from "../../GameElement.js";
import {shuffled, sideTernary} from "../../consts.js";
import Card, {getVictim, Stat} from "../../Card.js";
import {BeforeGameState, EndGameState, TurnState} from "../../GameStates.js";
import {CardTriggerType, InterruptScareResult} from "../../CardData.js";
import {CardActionOptions} from "../CardActionOption.js";
import processCardAction from "./BackendProcessCardAction.js";
import {acceptEvent, type Client, type processedEvent, processedEventMarker, rejectEvent} from "./BackendServer.js";
import dev from "../../dev.js";

export const usersFromGameIDs:{[k:string]:Array<Client>}={};
const gamesFromUser:Map<Client, Game> = new Map();

//--

export function sendToGame(event:GameEvent<any>, game:Game, ...toIgnore:(Client|undefined)[]) {
    for(const user of (usersFromGameIDs[game!.gameID]??[])){
        if(toIgnore.indexOf(user) === -1){
            user.send(event);
        }
    }
}

export function gameServerWSClose(client:Client){
    const game = gamesFromUser.get(client);
    if(!game) return;

    game.state = new EndGameState(game, game.player(Side.A) === client ? Side.B : Side.A);
    sendToGame(new GameWinDefaultEvent({}),game);
}

//Draws a card. This also handles decrementing the turn, this can be disabled with isAction=false
//@returns If a card was actually drawn
export function draw(game: Game, dontSendTo: Client|undefined, side: Side, isAction:boolean, clarifyTo?:Client){
    const card = sideTernary(side, game.deckA, game.deckB).pop();
    if(card !== undefined) {
        clarifyTo?.send(new ClarifyCardEvent({
            id: card.id,
            cardDataName: card.cardData.name
        }));
    }
    if(card !== undefined){
        sideTernary(side, game.handA, game.handB).push(card);
        sendToGame(new DrawAction({side: side, isAction}, undefined), game, dontSendTo);
        game.freezableAction(()=> {
            if(game.state instanceof TurnState && isAction) {
                if (game.state.decrementAction()) {
                    // if (sideTernary(game.state.turn, game.handA, game.handB).length < 5) {
                    //     draw(game, undefined, game.state.turn, false, game.player(game.state.turn));
                    // }
                }
            }
        });
        return true;
    }else{
        return false;
    }
}
export function endTurn(game:Game, toNextTurn=false){
    game.freezableAction(()=>{
        for(const card of [...game.fieldsA, ...game.fieldsB, ...game.handA, ...game.handB])
            card?.callAction(CardTriggerType.AFTER_ACTION, {self:card, game:game});

        if (game.state instanceof TurnState) {
            if (game.state.decrementAction(false, toNextTurn)) {
                // if (sideTernary(game.state.turn, game.handA, game.handB).length < 5) {
                //     game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[game.state.turn], "draw");
                //     console.log("mrf")
                // }
                    // draw(game, undefined, game.state.turn, false, game.player(game.state.turn));
            }
        }
    });
}
export function shuffleBackend(deck:Array<Card>){
    const ids = deck.map(card=>card.id);
    shuffled(deck);
    for(let i=0;i<deck.length;i++){
        deck[i]!.setId(ids[i]!);
    }
}

function internalScareInterrupt(cards:(Card|undefined)[], data:{
    scared: Card
    scarer: Card
    stat: Stat | "card"
    game: Game
    origEvent: ScareAction
}, next:(succeeded: boolean) => void){
    const mappedCards=cards.map(c=>[c, c?.callAction(CardTriggerType.SCARE_INTERRUPT_EFFECT_TYPE, {
        self: c,
        scared: data.scarer,
        scarer: data.scared,
        stat: data.stat,
        game: data.game,
        event: data.origEvent,
    })?.valueOf() ?? -1] satisfies [Card|undefined, number]).sort((c1, c2)=> c2[1]-c1[1]);
    for(let i=0;i<mappedCards.length;i++) {
        const card = mappedCards[i]![0];
        if(card===undefined) continue;

        const result = card.callAction(CardTriggerType.INTERRUPT_SCARE, {
            ...data,
            self: card,
            next: (succeeded)=> {
                if(!succeeded) next(false);
                else internalScareInterrupt(mappedCards.slice(i + 1).map(v=>v[0]), data, next);
            }
        });
        switch(result){
            case InterruptScareResult.FAIL_SCARE: next(false); return;
            case InterruptScareResult.PREVENT_SCARE: return;
        }
    }
    next(true);
}

/**
 * Calls any/all interrupt scares. This should be called whenever you're trying to scare a card AND the attempt would
 * succeed (the stats work, or it's a special attack)
 * @param event The event this scare comes from
 * @param game The game this scare is happening in
 * @param scarer The card that is doing the scaring
 * @param scared The card being scared
 * @param scareType The scare type
 * @param onPass The function to run if/when the scare passes
 */
export function scareInterrupt(event:ScareAction, game:Game, scarer:Card, scared:Card, scareType:Stat|"card", onPass:(succeeded:boolean)=>void){
    const cards = [...game.fieldsA, ...game.fieldsB];
    internalScareInterrupt(cards, { scared, scarer, game, stat: scareType, origEvent:event }, onPass);
}

export function parseEvent(event:GameEvent<any>):processedEvent{
    //todo: verify things are in array bounds!!!!
    const game = gamesFromUser.get(event.sender!) ?? (event instanceof ActionEvent ? event.getGame() : undefined);

    if(game === undefined){
        if(event instanceof InternalStartGameEvent){
            usersFromGameIDs[event.game.gameID] = [
                event.p1,
                event.p2
            ];
            gamesFromUser.set(event.p1, event.game);
            gamesFromUser.set(event.p2, event.game);
            event.game.setPlayers(event.p1, event.p2);

            event.p1.send(new GameStartEvent({
                deck:event.game.deckA.map(card=>card.id),
                otherDeck: event.game.deckB.map(card => card.id),
                which:Side.A,
            }));
            event.p2.send(new GameStartEvent({
                deck:event.game.deckB.map(card=>card.id),
                otherDeck:event.game.deckA.map(card => card.id),
                which:Side.B,
            }));
            sendToGame(new GameStartEventWatcher({
                deck:event.game.deckA.map(card => card.id),
                otherDeck:event.game.deckB.map(card => card.id),
                which:Side.B,
            }), event.game, event.p1, event.p2);
            for(let i=0;i<3;i++){
                draw(event.game, undefined, Side.A, true, event.game.player(Side.A));
                draw(event.game, undefined, Side.B, true, event.game.player(Side.B));
            }

            return acceptEvent(event);
        }

        return rejectEvent(event, "not in a game");
    }

    const senderSide = event.sender === game.player(Side.A) ? Side.A : Side.B
    const nextEvent = game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[senderSide]);
    if(nextEvent !== undefined){
        if(event instanceof ActionEvent &&
            //to remove the squiggly, add the generic (you cant though, itll error)
            (!(event instanceof CardAction) || event.data.actionName !== nextEvent ||
                nextEvent === CardActionOptions.CANNOT_PLAY)){
            return rejectEvent(event, "failed NEXT_ACTION_SHOULD_BE check, "+nextEvent);
        }
    }

    const freezeData = game.getMiscData(GameMiscDataStrings.FROZEN);
    if(freezeData!==undefined && freezeData.isFrozen && !freezeData.allowThrough(event))
        return rejectEvent(event, "game is currently frozen, this event is not allowed through");

    if(event instanceof StartRequestEvent){
        if(!(game.state instanceof BeforeGameState))
            return rejectEvent(event, "not beforeGameState (startrequest)");

        game.setMiscData((event.sender === game.player(Side.A))?
            GameMiscDataStrings.PLAYER_A_STARTREQ : GameMiscDataStrings.PLAYER_B_STARTREQ, event.data.which);

        const playerAStartReq = game.getMiscData(GameMiscDataStrings.PLAYER_A_STARTREQ);
        const playerBStartReq = game.getMiscData(GameMiscDataStrings.PLAYER_B_STARTREQ);
        if(playerAStartReq !== undefined && playerBStartReq !== undefined){
            let startingSide: Side;
            let flippedCoin: boolean;

            if(playerAStartReq === playerBStartReq){
                flippedCoin=true;
                startingSide = Math.random()<0.5 ? Side.A : Side.B;
            }else{
                flippedCoin=false;
                if(playerAStartReq === "nopref"){
                    startingSide = playerBStartReq === "first" ? Side.B : Side.A;
                }else{//b nopref OR first and second
                    startingSide = playerAStartReq === "first" ? Side.A : Side.B;
                }
            }

            for(const user of (usersFromGameIDs[game.gameID]||[])){
                user.send(new DetermineStarterEvent({
                    starter:startingSide,
                    flippedCoin:flippedCoin,
                }));
                for(const card of game.fieldsA)
                    if(card !== undefined)
                        user.send(new ClarifyCardEvent({
                            id: card.id,
                            cardDataName:card.cardData.name,
                        }));
                for(const card of game.fieldsB)
                    if(card !== undefined)
                        user.send(new ClarifyCardEvent({
                            id: card.id,
                            cardDataName:card.cardData.name,
                        }));
                game.state = new TurnState(game, startingSide);
            }
        }
        return acceptEvent(event);
    }else if(event instanceof PlaceAction){
        const card = [...game.cards.values()]
            .find(card=>card.id === event.data.cardId);
        if(card === undefined) return rejectEvent(event, "no card found placeaction");
        const placedForFree = event.isForcedFree() || card.isAlwaysFree() || card.isFreeNow();

        // if(!event.isForced()) {
        //     if (event.game.state instanceof TurnState && !event.game.state.drawnToStart)
        //         return rejectEvent(event, "not draw to start yet p");
        //     if (event.game.getMiscData(GameMiscDataStrings.LAST_ACTIONED))
        //         return rejectEvent(event, "already performed last action p");
        // }

        if(!event.isForced()) {
            //validate
            if (!((game.state instanceof BeforeGameState &&//BEFORE GAME
                    game.player(card.side) === event.sender &&//card is the player's
                    card.cardData.level === 1 && //card is level 1
                    (game.player(Side.A) === event.sender) === (event.data.side === Side.A)) || //player is on the same side as the field
                (game.state instanceof TurnState &&//TURN
                    event.sender === game.player(game.state.turn) &&//it is the sender's turn
                    game.player(card.side) === event.sender &&//card is the player's
                    sideTernary(card.side, game.fieldsA, game.fieldsB)
                        .some(other => (other?.cardData.level ?? 0) >= card.cardData.level - 1) &&//placed card's level is at most 1 above all other cards
                    game.state.drawnToStart &&//player has already started turn
                    game.state.actionsLeft+(placedForFree ? 1 : 0)>0))) {// player has actions left
                if (!(card.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK, {
                    self: card,
                    game: game,
                    normallyValid: false
                }) ?? false)) {
                    return rejectEvent(event, "failed place check");
                }
            } else if (!(card.callAction(CardTriggerType.SPECIAL_PLACEABLE_CHECK, {
                self: card,
                game: game,
                normallyValid: true
            }) ?? true)) {
                return rejectEvent(event, "failed place check: custom");
            }
            event.data.forFree=false;
        }

        for(const group of [game.handA, game.handB]) {
            for (let i = 0; i < group.length; i++) {
                if (group[i] === card) {
                    group.splice(i, 1);
                    break;
                }
            }
        }
        sideTernary(event.data.side, game.fieldsA, game.fieldsB)[event.data.position-1] =
            [...game.cards.values()].find(card => card.id === event.data.cardId);

        for(const user of (usersFromGameIDs[game.gameID]||[])){
            if(user === event.sender) continue;
            user.send(new ClarifyCardEvent({
                id: event.data.cardId,
                ...(game.state instanceof BeforeGameState ? {} : {cardDataName:card.cardData.name}),
                faceUp: !(game.state instanceof BeforeGameState)
            }));
            user.send(new PlaceAction({
                cardId:event.data.cardId,
                position:event.data.position,
                side:event.data.side,
                forFree:placedForFree,
            }));
        }

        card.callAction(CardTriggerType.PRE_PLACED, {self:card, game:game});
        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.wait.then(()=>{
            card.callAction(CardTriggerType.PLACED, {self:card, game:game});
        });

        if(!placedForFree)
            endTurn(game);
        return acceptEvent(event);
    }else if(event instanceof DrawAction){
        let side:Side|undefined=undefined;//the side of the player drawing
        if(event.sender === game.player(Side.A)){
            side = Side.A;
        }else if(event.sender === game.player(Side.B)){
            side = Side.B;
        }

        if(side === undefined) return rejectEvent(event, "couldnt determine client side");
        if(!(game.state instanceof TurnState &&
            game.state.turn === side &&//it is the player's turn
            sideTernary(side, game.handA, game.handB).length<5 &&//their hand is less than 5
            game.state.actionsLeft>0))//they have actions left
            return rejectEvent(event, "failed draw check");

        const canPredraw = game.getMiscData(GameMiscDataStrings.CAN_PREDRAW) ?? false;
        if(draw(game, canPredraw ? undefined : event.sender, side,
                !canPredraw && game.state.drawnToStart, event.sender)){
            game.setMiscData(GameMiscDataStrings.CAN_PREDRAW, false);
            game.state.setDrawnToStart();
            return acceptEvent(event);
        }
        return rejectEvent(event, "couldnt draw (empty deck)");
    }else if (event instanceof PassAction){
        if(!event.isForced()) {
            if (game.state instanceof TurnState && !game.state.drawnToStart)
                return rejectEvent(event, "not draw to start yet pa");
            if (!(game.state instanceof TurnState &&
                event.sender === game.player(game.state.turn) &&//if its the player's turn
                sideTernary(game.state.turn, game.handA, game.handB).length <= 5))//if the player doesnt have to discard
                return rejectEvent(event, "failed pass check");
        }

        for(const user of (usersFromGameIDs[game.gameID]||[])){
            if(user === event.sender) continue;
            user.send(new PassAction({}));
        }

        endTurn(game, true);
        return acceptEvent(event);//todo:validation (what does this mean?)
    }else if (event instanceof ScareAction){
        if(!event.isForced()) {
            if (game.state instanceof TurnState && !game.state.drawnToStart)
                return rejectEvent(event, "not draw to start yet s");
        }

        if(!event.isForced() && event.sender !== game.player(event.data.scarerPos[1]))
            rejectEvent(event, "scarer is not consistent");

        let scarer = sideTernary(event.data.scarerPos[1], game.fieldsA, game.fieldsB)[event.data.scarerPos[0]-1];
        let scared = sideTernary(event.data.scaredPos[1], game.fieldsA, game.fieldsB)[event.data.scaredPos[0]-1];
        let forceFailed:boolean|undefined=undefined;

        if(!event.isForced()) {
            if (!(game.state instanceof TurnState &&
                game.getMiscData(GameMiscDataStrings.IS_FIRST_TURN) === false && //not first turn
                event.sender === game.player(game.state.turn) &&//if its the player's turn
                game.state.actionsLeft>0 && //player has actions left
                scarer !== undefined && scared !== undefined &&//the cards exist
                !scarer.hasAttacked &&//if the card hasnt scared yet
                event.data.attackingWith !== "card" &&//not a card attack (those cannot be parsed here, and shouldnt be sent from the client)
                scarer.stat(event.data.attackingWith) !== undefined &&
                scared.stat(getVictim(event.data.attackingWith)) !== undefined)) {
                return rejectEvent(event, "failed scare check");
            }
        }else{
            scarer=scarer!;
            scared=scared!;
            forceFailed=event.data.failed;
        }

        let ranRightAway=false;
        scareInterrupt(event, game, scarer, scared, event.data.attackingWith, (succeeded) => {
            ranRightAway = true;

            let scarer = sideTernary(event.data.scarerPos[1], game!.fieldsA, game!.fieldsB)[event.data.scarerPos[0] - 1];
            let scared = sideTernary(event.data.scaredPos[1], game!.fieldsA, game!.fieldsB)[event.data.scaredPos[0] - 1];
            if (scarer === undefined || scared === undefined) {
                console.log("some weird error");
                return;
            }

            const autofail = (event.data.attackingWith !== "card" &&
                (scarer.stat(event.data.attackingWith) === undefined ||
                    scared.stat(getVictim(event.data.attackingWith)) === undefined));

            const failed = forceFailed ?? (!succeeded || (autofail || (event.data.attackingWith === "card" ||
                !((scarer.stat(event.data.attackingWith)! >= scared.stat(getVictim(event.data.attackingWith))!)))));
            if(failed) scared = scarer;
            const toSend = new ScareAction({
                scaredPos: scared.getCardPos()!,
                scarerPos: scarer.getCardPos()!,
                attackingWith: event.data.attackingWith,
                failed,
                free: event.isForcedFree(),
            });
            scarer.hasAttacked = true;
            for (const user of (usersFromGameIDs[game.gameID] || [])) {
                user.send(toSend);
            }

            sideTernary(scared.side, game.runawayA, game.runawayB).push(
                sideTernary(scared.side, game.fieldsA, game.fieldsB)[event.data.scaredPos[0] - 1]!);
            sideTernary(scared.side, game.fieldsA, game.fieldsB)[event.data.scaredPos[0] - 1] = undefined;

            scared.callAction(CardTriggerType.AFTER_SCARED,
                {self: scared, scared, scarer, game: game, stat: event.data.attackingWith});
            for (const card of [...game.fieldsA, ...game.fieldsB, ...game.handA, ...game.handB]) {
                if (card === undefined) continue;

                card.callAction(CardTriggerType.AFTER_SCARED,
                    {self: card, scared, scarer, game: game, stat: event.data.attackingWith});
            }


            if (!event.isForcedFree()) endTurn(game);
        });
        if(ranRightAway)
            return acceptEvent(event);
        else{
            network.replyToClient(event, new PerchanceEvent({}, undefined, event.id));
            return processedEventMarker;
        }
    }else if(event instanceof CardAction){
        return processCardAction(event, game);
    }else if(event instanceof DiscardAction){
        // if(event.game.getMiscData(GameMiscDataStrings.LAST_ACTIONED))
        //     return rejectEvent(event, "already performed last action d");

        let side: Side | undefined = undefined;//the side of the player discarding
        if (event.sender === game.player(Side.A)) {
            side = Side.A;
        } else if (event.sender === game.player(Side.B)) {
            side = Side.B;
        }
        if (side === undefined) return rejectEvent(event, "discard couldnt validate sender");

        const hand = sideTernary(side, game.handA, game.handB);
        const toDiscard = hand.find(card => card.id === event.data.id);
        if (!(game.state instanceof TurnState &&
            event.sender === game.player(game.state.turn) &&//if its the player's turn
            toDiscard !== undefined&&//the card exists AND is in the player's hand
            hand.length>5)) {//the player is in a position to discard

            return rejectEvent(event, "failed discard check");
        }
        game.player(other(side))?.send(new DiscardAction({
            id:event.data.id,
            side
        }));

        sideTernary(side, game.runawayA, game.runawayB).push(
            hand.splice(hand.indexOf(toDiscard),1)[0]!);
        return acceptEvent(event);
    }else if(event instanceof ClarifyCardEvent){

        let shouldClarify:Card|Card[]|undefined=undefined;
        let maybeJustfication:ClarificationJustification|undefined;
        switch(event.data.justification){
            case ClarificationJustification.BROWNIE:
                const senderSide = game.player(Side.A) === event.sender ? Side.A : Side.B;
                if(game.state instanceof TurnState &&
                    (game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
                        [senderSide])) === CardActionOptions.BROWNIE_DRAW &&
                    sideTernary(senderSide, game.fieldsA, game.fieldsB)
                        .find(card =>card?.cardData.name === "og-005")!==undefined) {

                    shouldClarify = sideTernary(senderSide, game.deckA, game.deckB)
                        .filter(card => card.cardData.level === 1 &&
                            card.isAlwaysFree());
                }
                break;
            case ClarificationJustification.AMBER:
                if(game.state instanceof TurnState &&
                    event.sender === game.player(game.state.turn) &&
                    sideTernary(game.state.turn, game.fieldsA, game.fieldsB)
                        .find(card =>card !== undefined && card.cardData.name === "og-018")) {

                    shouldClarify = sideTernary(game.state.turn, game.deckA, game.deckB)
                        .slice(-2);
                    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[game.state.turn],
                        CardActionOptions.AMBER_PICK);
                }
                break;
            case ClarificationJustification.FURMAKER: {
                if (game.state instanceof TurnState &&
                    event.sender === game.player(game.state.turn) &&
                    sideTernary(game.state.turn, game.fieldsA, game.fieldsB)
                        .find(card => card !== undefined && card.cardData.name === "og-041")
                        ?.id === event.data.id) {

                    shouldClarify = sideTernary(game.state.turn, game.deckA, game.deckB);
                    maybeJustfication = ClarificationJustification.FURMAKER;
                    game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE, CardActionOptions.FURMAKER_PICK);
                }
            }break;
            case ClarificationJustification.FURMAKER_VISIBLE: {
                const side = event.sender === game.player(Side.A) ? Side.A : Side.B;
                if(sideTernary(side, game.fieldsB, game.fieldsA).some(card=>card?.cardData.name === "og-041"))
                    shouldClarify = sideTernary(side, game.handB, game.handA);
            }break;
        }

        if(shouldClarify instanceof Array){
            if(shouldClarify.length>0) {
                network.replyToClient(event, multiClarifyFactory(shouldClarify, maybeJustfication));
                return acceptEvent(event);
            }
        }
        if(shouldClarify instanceof Card){
            network.replyToClient(event, new ClarifyCardEvent({
                id: shouldClarify.id,
                cardDataName: shouldClarify.cardData.name,
                ...(maybeJustfication?{justification:maybeJustfication}:{})
            }));
            return acceptEvent(event);
        }

        return rejectEvent(event, "no suitable cards found");
    }

    else if(event instanceof RequestServerDumpAction && dev){
        network.replyToClient(event, new ServerDumpEvent({
            fieldsA:game.fieldsA.map(card=>card?.cardData.name) as [string|undefined,string|undefined,string|undefined],
            fieldsB:game.fieldsB.map(card=>card?.cardData.name) as [string|undefined,string|undefined,string|undefined],
            handA:game.handA.map(card=>card?.cardData.name),
            handB:game.handB.map(card=>card?.cardData.name),
            runawayA:game.runawayA.map(card=>card?.cardData.name),
            runawayB:game.runawayB.map(card=>card?.cardData.name),
            deckA:game.deckA.map(card=>card?.cardData.name),
            deckB:game.deckB.map(card=>card?.cardData.name),

            crisises:{A:game.getCrisis(Side.A), B:game.getCrisis(Side.B)},

            ...(game.state instanceof TurnState?{
                currTurn: sideTernary(game.state.turn, "A", "B"),
                actionsLeft: game.state.actionsLeft
            }:{})
        }));

        return acceptEvent(event);
    }

    else return rejectEvent(event, "not a recognized game event");
}
