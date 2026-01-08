import {eventReplyIds, network, Replyable} from "./Server.js";
import * as Events from "./Events.js";
import {
    AcceptEvent,
    ActionEvent,
    CardAction,
    cardsTransform,
    ClarificationJustification,
    ClarifyCardEvent,
    DetermineStarterEvent,
    DiscardEvent,
    DrawAction,
    Event,
    FindGameEvent,
    GameStartEvent,
    GameStartEventWatcher,
    InvalidEvent,
    multiClarifyFactory,
    PassAction,
    PlaceAction,
    RejectEvent,
    RequestSyncEvent,
    ScareAction,
    SerializableClasses,
    type SerializableType,
    StartRequestEvent,
    StringReprSyncEvent,
    SyncEvent
} from "./Events.js";
import Game, {GameMiscDataStrings} from "../Game.js";
import {v4 as uuid} from "uuid"
import {Side} from "../GameElement.js";
import {shuffled, sideTernary} from "../consts.js";
import Card, {getVictim, Stat} from "../Card.js";
import cards from "../Cards.js";
import {BeforeGameState, TurnState} from "../GameStates.js";
import {loadBackendWrappers} from "./BackendCardData.js";
import {CardActionType, InterruptScareResult, Species} from "../CardData.js";
import {CardActionOptions} from "./CardActionOption.js";
import processCardAction from "./BackendProcessCardAction.js";

export type Client ={send:(v:Event<any>)=>void};
export const usersFromGameIDs:{[k:string]:Array<Client>}={};
const gamesFromUser:Map<any, Game> = new Map();
const unfilledGames:Array<(v:FindGameEvent)=>void> = [];

export function backendInit(){
    loadBackendWrappers();
    console.log("Backend initialized");
}

//--

export function rejectEvent(event:Event<any>, reason:string){
    network.replyToClient(event, new RejectEvent({}, undefined, undefined, event.id));
    console.log(`# rejected ${event.id}(${typeof event}): ${reason}`)
}
export function acceptEvent(event:Event<any>){
    network.replyToClient(event, new AcceptEvent({}, undefined, undefined, event.id));
}
export function sendToClients(event:Event<any>, ...toIgnore:(Client|undefined)[]) {
    for(const user of (usersFromGameIDs[event.game!.gameID]||[])){
        if(toIgnore.indexOf(user) === -1){
            user.send(event);
        }
    }
}

//Draws a card. This also handles decrementing the turn, this can be disabled with isAction=false
//@returns If a card was actually drawn
export function draw(game: Game, sender: Client|undefined, side: Side, isAction:boolean, sendTo?:Client){
    const card = sideTernary(side, game.deckA, game.deckB).pop();
    if(card !== undefined) {
        sendTo?.send(new ClarifyCardEvent({
            id: card.id,
            cardDataName: card.cardData.name
        }));
    }
    if(card !== undefined){
        sideTernary(side, game.handA, game.handB).push(card);
        sendToClients(new DrawAction({side: side, isAction}, game, undefined), sender);
        if(game.state instanceof TurnState && isAction) {
            if(game.state.decrementTurn()){
                if(sideTernary((game.state as TurnState).turn, game.handA, game.handB).length<5) {
                    draw(game, undefined, game.state.turn, false, game.player(game.state.turn));
                }
            }
        }
        return true;
    }else{
        return false;
    }
}
export function endTurn(game:Game){
    if(game.state instanceof TurnState) {
        if (game.state.decrementTurn()) {
            if (sideTernary(game.state.turn, game.handA, game.handB).length < 5)
                draw(game, undefined, game.state.turn, false, game.player(game.state.turn));
        }
    }
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
    if(event.interruptScareBypass !== bypassInterruptScareMarker){
        for(const card of sideTernary(scared.side, game.fieldsA, game.fieldsB)) {
            if(card===undefined) continue;

            const result = scared.callAction(CardActionType.INTERRUPT_SCARE,
                { self: card, scared, scarer, game, stat: scareType, origEvent:event, next:onPass });
            switch(result){
                case InterruptScareResult.FAIL_SCARE: onPass(false); return;
                case InterruptScareResult.PREVENT_SCARE: return;
            }
        }
    }
    onPass(true);
}

const bypassInterruptScareMarker = {};//todo: is this needed?

export function parseEvent(event:Event<any>){
    //todo: verify things are in array bounds!!!!

    if(event.game !== undefined){
        const nextEvent = event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
            [event.sender === event.game.player(Side.A) ? Side.A : Side.B]);
        if(nextEvent !== undefined){
            if(event instanceof ActionEvent &&
                //?? what (talking about yellow squiggly)
                (!(event instanceof CardAction) || event.data.actionName !== nextEvent)){
                rejectEvent(event, "failed NEXT_ACTION_SHOULD_BE check");
                return;
            }
        }
    }

    if(event instanceof FindGameEvent){
        if(!event.data.deck.some(card => cards[card]?.level === 1)) {
            return;
        }
        const cardDuplChecker:{[key:string]:true} = {};
        for(const card of event.data.deck) {
            if (cardDuplChecker[card] !== undefined) return;
            cardDuplChecker[card] = true;
        }

        if(unfilledGames.length>0){
            const gamePromise = unfilledGames.shift()!;
            gamePromise(event);
        }else{
            let resolve:(v:FindGameEvent)=>void;
            const waiter = new Promise<FindGameEvent>(r=>resolve=r);
            waiter.then((other) => {
                let id=0;

                //debug code
                const firstCard = event.data.deck[0];
                const firstCardB = other.data.deck[0];

                const deckA = shuffled(event.data.deck).map(name=>{return{type:name,id:id++}});
                const deckB = shuffled(other.data.deck).map(name=>{return{type:name,id:id++}});

                //debug code
                if(firstCard !== undefined)
                    deckA.push(deckA.splice(deckA.findIndex(card => card.type === firstCard), 1)[0]!);
                if(firstCardB !== undefined)
                    deckB.push(deckB.splice(deckB.findIndex(card => card.type === firstCardB), 1)[0]!);

                let hasLevel1A=false;
                let hasLevel1B=false;
                for(let i=0;i<3;i++){
                    if(!hasLevel1A && deckA[deckA.length-1-i]?.type !== undefined && cards[deckA[deckA.length-1-i]?.type!]?.level === 1){
                        hasLevel1A=true;
                    }
                    if(!hasLevel1B && deckB[deckB.length-1-i]?.type !== undefined && cards[deckB[deckB.length-1-i]?.type!]?.level === 1){
                        hasLevel1B=true;
                    }
                }
                if(!hasLevel1A){
                    const toFront = shuffled(deckA.filter(card => cards[card.type]?.level === 1))[0]!;
                    deckA.splice(deckA.indexOf(toFront), 1);
                    deckA.splice(deckA.length-Math.floor(Math.random()*3), 0, toFront);
                }
                if(!hasLevel1B){
                    const toFront = shuffled(deckB.filter(card => cards[card.type]?.level === 1))[0]!;
                    deckB.splice(deckB.indexOf(toFront), 1);
                    deckB.splice(deckB.length-Math.floor(Math.random()*3), 0, toFront);
                }

                const game = new Game(deckA, deckB, uuid());

                usersFromGameIDs[game.gameID] = [
                    event.sender!,
                    other.sender!
                ];
                gamesFromUser.set(event.sender!, game);
                gamesFromUser.set(other.sender!, game);
                game.setPlayers(event.sender!, other.sender!);

                network.replyToClient(event, new GameStartEvent({
                    deck:deckA.map(card=>card.id),
                    otherDeck: deckB.map(card => card.id),
                    which:Side.A,
                }, game));
                network.replyToClient(other, new GameStartEvent({
                    deck:deckB.map(card=>card.id),
                    otherDeck:deckA.map(card => card.id),
                    which:Side.B,
                }, game));
                sendToClients(new GameStartEventWatcher({
                    deck:deckB.map(card => card.id),
                    otherDeck:deckA.map(card => card.id),
                    which:Side.B,
                }, game), event.sender, other.sender);
                for(let i=0;i<3;i++){
                    draw(game, undefined, Side.A, true, game.player(Side.A));
                    draw(game, undefined, Side.B, true, game.player(Side.B));
                }
            })
            unfilledGames.push(resolve!);
        }
    }else if(event instanceof StartRequestEvent){
        if(event.game!==undefined && event.game.state instanceof BeforeGameState){
            event.game.setMiscData((event.sender === event.game.player(Side.A))?
                GameMiscDataStrings.PLAYER_A_STARTREQ : GameMiscDataStrings.PLAYER_B_STARTREQ, event.data.which);

            const playerAStartReq = event.game.getMiscData(GameMiscDataStrings.PLAYER_A_STARTREQ);
            const playerBStartReq = event.game.getMiscData(GameMiscDataStrings.PLAYER_B_STARTREQ);
            if(playerAStartReq !== undefined &&
                playerBStartReq !== undefined){
                let startingSide: Side;
                let flippedCoin: boolean;

                if(playerAStartReq === playerBStartReq){
                    flippedCoin=true;
                    startingSide = Math.random()<0.5 ? Side.A : Side.B;
                }else{
                    flippedCoin=false;
                    if(playerAStartReq === "nopref"){
                        startingSide = playerBStartReq === "first" ? Side.B : Side.A;
                    }else if(playerBStartReq === "nopref"){
                        startingSide = playerAStartReq === "first" ? Side.A : Side.B;
                    }else{
                        //first and second
                        startingSide = playerBStartReq === "first" ? Side.B : Side.A;
                    }
                }

                for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                    user.send(new DetermineStarterEvent({
                        starter:startingSide,
                        flippedCoin:flippedCoin,
                    }));
                    for(const card of event.game.fieldsA)
                        if(card !== undefined)
                            user.send(new ClarifyCardEvent({
                                id: card.id,
                                cardDataName:card.cardData.name,
                            }));
                    for(const card of event.game.fieldsB)
                        if(card !== undefined)
                            user.send(new ClarifyCardEvent({
                                id: card.id,
                                cardDataName:card.cardData.name,
                            }));
                    event.game.state = new TurnState(event.game, startingSide, false);
                }
            }
        }
    }else if(event instanceof PlaceAction){
        if(event.game!==undefined){
            const card = event.game.cards.values().find(card=>card.id === event.data.cardId)!;

            //validate
            if(!((event.game.state instanceof BeforeGameState &&
                    event.game.player(card.side) === event.sender &&//card is the player's
                    card.cardData.level === 1 && //card is level 1
                    (event.game.player(Side.A) === event.sender) === (event.data.side === Side.A)) || //player is on the same side as the field
                (event.game.state instanceof TurnState &&
                    event.sender === event.game.player(event.game.state.turn) &&//it is the sender's turn
                    event.game.player(card.side) === event.sender &&//card is the player's
                    sideTernary(card.side, event.game.fieldsA, event.game.fieldsB)
                        .some(other => (other?.cardData.level??0) >= card.cardData.level-1)))){ //placed card's level is at most 1 above all other cards
                rejectEvent(event, "failed place check");
                return;
            }

            for(const group of [event.game.handA, event.game.handB]) {
                for (let i = 0; i < group.length; i++) {
                    if (group[i] === card) {
                        group.splice(i, 1);
                        break;
                    }
                }
            }
            sideTernary(event.data.side, event.game.fieldsA, event.game.fieldsB)[event.data.position-1] =
                event.game.cards.values().find(card => card.id === event.data.cardId);

            const placedForFree = card.callAction(CardActionType.IS_FREE, {self:card, game:event.game}) ?? false;

            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                if(user === event.sender) continue;
                if(event.data.faceUp)
                    user.send(new ClarifyCardEvent({
                        id: event.data.cardId,
                        cardDataName: card.cardData.name,
                        faceUp: event.data.faceUp,
                    }));
                user.send(new PlaceAction({
                    cardId:event.data.cardId,
                    position:event.data.position,
                    side:event.data.side,
                    faceUp:event.data.faceUp,
                    forFree:placedForFree,
                }));
            }

            card.callAction(CardActionType.PRE_PLACED, {self:card, game:event.game});
            event.game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.wait.then(()=>{
                card.callAction(CardActionType.PLACED, {self:card, game:event.game});
            });

            if(!placedForFree)
                endTurn(event.game);
            acceptEvent(event);
        }
    }else if(event instanceof DrawAction){
        if(event.game !== undefined){
            let side:Side|undefined=undefined;//the side of the player drawing
            if(event.sender === event.game.player(Side.A)){
                side = Side.A;
            }else if(event.sender === event.game.player(Side.B)){
                side = Side.B;
            }
            if(side !== undefined){
                if(!(event.game.state instanceof TurnState &&
                    event.game.state.turn === side &&//it is the player's turn
                    sideTernary(side, event.game.handA, event.game.handB).length<5)){//their hand is less than 5
                    rejectEvent(event, "failed draw check");
                    return;
                }

                const canPredraw = event.game.getMiscData(GameMiscDataStrings.CAN_PREDRAW) ?? false;
                if(draw(event.game, canPredraw ? undefined : event.sender, side, !canPredraw, event.sender)){
                    acceptEvent(event);
                    event.game.setMiscData(GameMiscDataStrings.CAN_PREDRAW, false);
                    return;
                }
            }
            rejectEvent(event, "couldnt determine client side");
        }
    }else if (event instanceof PassAction){
        if(event.game !== undefined){
            if(!(event.game.state instanceof TurnState &&
                event.sender === event.game.player(event.game.state.turn) &&//if its the player's turn
                sideTernary(event.game.state.turn, event.game.handA, event.game.handB).length<=5)){//if the player doesnt have to discard
                rejectEvent(event, "failed pass check");
                return;
            }
            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                if(user === event.sender) continue;
                user.send(new PassAction({}));
            }

            endTurn(event.game);
            acceptEvent(event);//todo:validation
        }
    }else if (event instanceof ScareAction){
        if(event.game !== undefined){
            if(event.sender !== event.game.player(event.data.scarerPos[1]))
                rejectEvent(event, "scarer is not consistent");

            const scarer = sideTernary(event.data.scarerPos[1], event.game.fieldsA, event.game.fieldsB)[event.data.scarerPos[0]-1];
            const scared = sideTernary(event.data.scaredPos[1], event.game.fieldsA, event.game.fieldsB)[event.data.scaredPos[0]-1];
            if(!(event.game.state instanceof TurnState &&
                event.game.getMiscData(GameMiscDataStrings.IS_FIRST_TURN) === false &&
                event.sender === event.game.player(event.game.state.turn) &&//if its the player's turn
                scarer !==undefined && scared!==undefined&&//the cards exist
                !scarer.hasAttacked&&//if the card hasnt scared yet
                event.data.attackingWith !== "card" &&//not a card attack (those cannot be parsed here, and shouldnt be sent from the client)
                scarer.cardData.stat(event.data.attackingWith) !== undefined && scared.cardData.stat(getVictim(event.data.attackingWith)) !== undefined)){//neither stat is null
                rejectEvent(event, "failed scare check");
                return;
            }

            const game = event.game;
            scareInterrupt(event, event.game, scarer, scared, event.data.attackingWith, (succeeded)=>{
                if(event.data.attackingWith==="card") return;

                const toSend = new ScareAction({
                    scaredPos: event.data.scaredPos,
                    scarerPos: event.data.scarerPos,
                    attackingWith: event.data.attackingWith,
                    failed: !succeeded || !(scarer.cardData.stat(event.data.attackingWith)! >= scared.cardData.stat(getVictim(event.data.attackingWith))!)
                });
                scarer.hasAttacked = true;
                for (const user of (usersFromGameIDs[game.gameID] || [])) {
                    user.send(toSend);
                }
                if(succeeded) {
                    sideTernary(scared.side, game.fieldsA, game.fieldsB)[event.data.scaredPos[0] - 1] = undefined;

                    scared.callAction(CardActionType.AFTER_SCARED,
                        {self: scared, scarer, game: game, stat: event.data.attackingWith});
                }

                endTurn(game);
            });
        }
    }else if(event instanceof CardAction){
        processCardAction(event);
    }else if(event instanceof DiscardEvent){
        if(event.game !== undefined) {
            let side: Side | undefined = undefined;//the side of the player discarding
            if (event.sender === event.game.player(Side.A)) {
                side = Side.A;
            } else if (event.sender === event.game.player(Side.B)) {
                side = Side.B;
            }
            if (side === undefined) return rejectEvent(event, "discard couldnt validate sender");

            const hand = sideTernary(side, event.game.handA, event.game.handB);
            const toDiscard = hand.find(card => card.id === event.data.which);
            if (!(event.game.state instanceof TurnState &&
                event.sender === event.game.player(event.game.state.turn) &&//if its the player's turn
                toDiscard !== undefined&&//the card exists AND is in the player's hand
                hand.length>5)) {//the player is in a position to discard
                rejectEvent(event, "failed discard check");
                return;
            }

            sideTernary(side, event.game.runawayA, event.game.runawayB).push(
                hand.splice(hand.indexOf(toDiscard),1)[0]!);
            acceptEvent(event);
        }
    }else if(event instanceof ClarifyCardEvent){
        if(event.game !== undefined){
            let shouldClarify:Card|Card[]|undefined=undefined;
            switch(event.data.justification){
                case ClarificationJustification.BROWNIE:
                    if(event.game.state instanceof TurnState &&
                        (event.game.getMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE
                            [event.game.player(Side.A) === event.sender ? Side.A : Side.B])) === CardActionOptions.BROWNIE_DRAW &&
                        sideTernary(event.game.state.turn, event.game.fieldsA, event.game.fieldsB)
                            .find(card =>card?.cardData.name === "og-005")!==undefined) {

                        shouldClarify = sideTernary(event.game.state.turn, event.game.deckA, event.game.deckB)
                            .filter(card => card.cardData.level === 1 &&
                                card.getAction(CardActionType.IS_FREE) !== undefined);
                    }
                    break;
                case ClarificationJustification.AMBER://todo
                    if(event.game.state instanceof TurnState &&
                        event.sender === event.game.player(event.game.state.turn) &&
                        sideTernary(event.game.state.turn, event.game.fieldsA, event.game.fieldsB)
                            .find(card =>card !== undefined && card.cardData.name === "og-018")) {

                        shouldClarify = sideTernary(event.game.state.turn, event.game.deckA, event.game.deckB)
                            .find((card, i) => card.id === event.data.id && (i === 0 || i === 1));
                        event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE, CardActionOptions.AMBER_PICK);
                    }
                    break;
                case ClarificationJustification.FURMAKER://todo
                    if(event.game.state instanceof TurnState &&
                        event.sender === event.game.player(event.game.state.turn) &&
                        sideTernary(event.game.state.turn, event.game.fieldsA, event.game.fieldsB)
                            .find(card =>card !== undefined && card.cardData.name === "og-041")) {

                        shouldClarify=sideTernary(event.game.state.turn, event.game.deckA, event.game.deckB);
                        event.game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE, CardActionOptions.FURMAKER_PICK);
                    }
                    break;
            }

            if(shouldClarify !== undefined){
                if(shouldClarify instanceof Array){
                    if(shouldClarify.length>0) {
                        network.replyToClient(event, multiClarifyFactory(shouldClarify));
                        return acceptEvent(event);
                    }
                }else {
                    network.replyToClient(event, new ClarifyCardEvent({
                        id: shouldClarify.id,
                        cardDataName: shouldClarify.cardData.name
                    }));
                    return acceptEvent(event);
                }

                rejectEvent(event, "no suitable cards found");
            }
        }
    }

    //DEBUG, DONT UNCOMMENT UNLESS DEVELOPING
    else if(event instanceof RequestSyncEvent){
        if(event.game!==undefined) {
            event.sender?.send(new SyncEvent({
                fieldsA: cardsTransform(event.game.fieldsA as Array<Card>) as [Events.Card|undefined, Events.Card|undefined, Events.Card|undefined],
                fieldsB: cardsTransform(event.game.fieldsB as Array<Card>) as [Events.Card|undefined, Events.Card|undefined, Events.Card|undefined],
                deckA: cardsTransform(event.game.deckA),
                deckB: cardsTransform(event.game.deckB),
                handA: cardsTransform(event.game.handA),
                handB: cardsTransform(event.game.handB),
                runawayA: cardsTransform(event.game.runawayA),
                runawayB: cardsTransform(event.game.runawayB),
            }));
            network.replyToClient(event, new StringReprSyncEvent({
                str:`${event.game.state instanceof TurnState?(event.game.state.turn+" "+event.game.state.actionsLeft):""}\n`+
                    `${event.game.deckB.length} ${event.game.handB.length} ${event.game.runawayB.length}\n`+
                    `   ${event.game.fieldsB.filter(card=>card!==undefined).length}\n`+
                    `   ${event.game.fieldsA.filter(card=>card!==undefined).length}\n`+
                    `${event.game.runawayA.length} ${event.game.handA.length} ${event.game.deckA.length}\n`
            }, undefined, undefined, event.id));
        }
    }
}

export async function receiveFromClient (packed:{
    type:string,
    data:SerializableType,
    id:string
}, client:Client) {
    //todo: this smells like vulnerability (but less now!)
    const event = new (SerializableClasses[packed.type] || InvalidEvent)(
        //@ts-ignore
        packed.data,
        gamesFromUser.get(client), client, packed.id) as Event<any>;
    if(true && !(event instanceof RequestSyncEvent)) console.log("received "+event.serialize());

    if(event.game !== undefined && (eventReplyIds[event.game.gameID]||{})[event.id] !== undefined){
        ((eventReplyIds[event.game.gameID]||{})[event.id]?._callback||(()=>{}))(event);
        return;
    }

    //todo: verify shape of event
    parseEvent(event);
}
network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith);
    return new Replyable(replyWith);
}
