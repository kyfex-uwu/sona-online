import {eventReplyIds, network, Replyable} from "./Server.js";
import * as Events from "./Events.js";
import {
    AcceptEvent,
    CardAction,
    CardActionOptions,
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
    PassAction,
    PlaceAction,
    RejectEvent,
    RequestSyncEvent,
    ScareAction,
    StartRequestEvent,
    StringReprSyncEvent,
    SyncEvent
} from "./Events.js";
import Game from "../Game.js";
import {v4 as uuid} from "uuid"
import {other, Side} from "../GameElement.js";
import {shuffled, sideTernary, wait} from "../consts.js";
import Card, {getVictim} from "../Card.js";
import cards from "../Cards.js";
import {BeforeGameState, PickCardsState, TurnState} from "../GameStates.js";
import {loadBackendWrappers} from "./BackendCardData.js";
import {CardActionType} from "../CardData.js";

export type Client ={send:(v:Event<any>)=>void};
const usersFromGameIDs:{[k:string]:Array<Client>}={};
const gamesFromUser:Map<any, Game> = new Map();
const unfilledGames:Array<(v:FindGameEvent)=>void> = [];

export function backendInit(){
    loadBackendWrappers();
    console.log("Backend initialized");
}
function rejectEvent(event:Event<any>){
    network.replyToClient(event, new RejectEvent({}, undefined, undefined, event.id));
}
function acceptEvent(event:Event<any>){
    network.replyToClient(event, new AcceptEvent({}, undefined, undefined, event.id));
}

//Draws a card. This also handles decrementing the turn, this can be disabled with isAction=false
//@returns If a card was actually drawn
function draw(game: Game, sender: Client|undefined, side: Side, isAction:boolean=true){
    const card = sideTernary(side, game.deckA, game.deckB).pop();
    if(card !== undefined){
        sideTernary(side, game.handA, game.handB).push(card);
        for(const user of (usersFromGameIDs[game.gameID]||[])){
            if(user !== sender){
                user.send(new DrawAction({side: side, isAction}, undefined, undefined));
            }
        }
        if(game.state instanceof TurnState && isAction) {
            if(game.state.decrementTurn()){
                if(game.state.serverInit()){
                    for(const user of (usersFromGameIDs[game.gameID]||[])){
                        user.send(new DrawAction({side: game.state.turn, isAction:false}, undefined, undefined));
                    }
                }
            }
        }
        return true;
    }else{
        return false;
    }
}
function endTurn(game:Game){
    if(game.state instanceof TurnState) {
        if (game.state.decrementTurn() && sideTernary(game.state.turn, game.handA, game.handB).length < 5)
            draw(game, undefined, game.state.turn, false);
    }
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

const bypassInterruptScareMarker = {};

function parseEvent(event:Event<any>, client:Client){
    //todo: verify things are in array bounds!!!!
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
                const deckA = shuffled(event.data.deck).map(name=>{return{type:name,id:id++}});
                const deckB = shuffled(other.data.deck).map(name=>{return{type:name,id:id++}});
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
                    deck:deckA,
                    otherDeck: deckB.map(card => card.id),
                    which:Side.A,
                }, game));
                network.replyToClient(other, new GameStartEvent({
                    deck:deckB,
                    otherDeck:deckA.map(card => card.id),
                    which:Side.B,
                }, game));
                for(const user of (usersFromGameIDs[game.gameID]||[])){
                    if(user !== event.sender && user !== other.sender){
                        user.send(new GameStartEventWatcher({
                            deck:deckB.map(card => card.id),
                            otherDeck:deckA.map(card => card.id),
                            which:Side.B,
                        }, game));
                    }
                }
                for(let i=0;i<3;i++){
                    draw(game, undefined, Side.A);
                    draw(game, undefined, Side.B);
                }
            })
            unfilledGames.push(resolve!);
        }
    }else if(event instanceof StartRequestEvent){
        if(event.game!==undefined && event.game.state instanceof BeforeGameState){
            event.game.miscData[(event.sender === event.game.player(Side.A))?
                "playerAStartRequest" :
                "playerBStartRequest"] = event.data.which;

            if(event.game.miscData.playerAStartRequest !== undefined &&
                event.game.miscData.playerBStartRequest !== undefined){
                let startingSide: Side;
                let flippedCoin: boolean;

                if(event.game.miscData.playerAStartRequest ===
                    event.game.miscData.playerBStartRequest){
                    flippedCoin=true;
                    startingSide = Math.random()<0.5 ? Side.A : Side.B;
                }else{
                    flippedCoin=false;
                    if(event.game.miscData.playerAStartRequest === "nopref"){
                        startingSide = event.game.miscData.playerBStartRequest === "first" ? Side.B : Side.A;
                    }else if(event.game.miscData.playerBStartRequest === "nopref"){
                        startingSide = event.game.miscData.playerAStartRequest === "first" ? Side.A : Side.B;
                    }else{
                        //first and second
                        startingSide = event.game.miscData.playerBStartRequest === "first" ? Side.B : Side.A;
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
                        .some(other => (other?.cardData.level??0) >= card.cardData.level-1) && //placed card's level is at most 1 above all other cards
                    !event.game.miscData.canPreDraw))){//not predraw
                rejectEvent(event);
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

            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                if(user === event.sender) continue;
                if(event.data.faceUp)
                    user.send(new ClarifyCardEvent({
                        id: event.data.cardId,
                        cardDataName: card.cardData.name,
                        faceUp: event.data.faceUp,
                    }));
                user.send(new PlaceAction({
                    ...event.data,
                }));
            }

            const action = card.cardData.getAction(CardActionType.PLACED);
            if(action !== undefined) action({self:card, game:event.game});

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
                    rejectEvent(event);
                    return;
                }
                if(event.game.miscData.canPreDraw){
                    const card = sideTernary(side, event.game.deckA, event.game.deckB).pop();
                    if(card !== undefined){//bro it better not be
                        sideTernary(side, event.game.handA, event.game.handB).push(card);
                        for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                            if(user !== event.sender){
                                user.send(new DrawAction({side: side, isAction:false}, undefined, undefined));
                            }
                        }
                    }

                    if(event.game.miscData.canPreDraw) event.game.miscData.canPreDraw=false;
                    acceptEvent(event);
                    return;
                }

                if(draw(event.game, event.sender, side)){
                    acceptEvent(event);
                    return;
                }
            }
            rejectEvent(event);
        }
    }else if (event instanceof PassAction){
        if(event.game !== undefined){
            if(!(event.game.state instanceof TurnState &&
                event.sender === event.game.player(event.game.state.turn))){//if its the player's turn
                rejectEvent(event);
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
            let side:Side|undefined=undefined;//the side of the player scaring
            if(event.sender === event.game.player(Side.A)){
                side = Side.A;
            }else if(event.sender === event.game.player(Side.B)){
                side = Side.B;
            }
            if(side===undefined) return rejectEvent(event);

            const scarer = sideTernary(side, event.game.fieldsA, event.game.fieldsB)[event.data.scarerPos-1];
            const scared = sideTernary(side, event.game.fieldsB, event.game.fieldsA)[event.data.scaredPos-1];
            if(!(event.game.state instanceof TurnState &&
                event.sender === event.game.player(event.game.state.turn) &&//if its the player's turn
                scarer !==undefined && scared!==undefined&&//the cards exist
                !scarer.hasAttacked&&//if the card hasnt scared yet
                scarer.cardData.stat(event.data.attackingWith) !== undefined && scared.cardData.stat(getVictim(event.data.attackingWith)) !== undefined)){//neither stat is null
                rejectEvent(event);
                return;
            }

            if(event.interruptScareBypass !== bypassInterruptScareMarker){
                const interruptAction = scared.cardData.getAction(CardActionType.INTERRUPT_SCARE);
                // if(interruptAction !== undefined) interruptAction({self:scared, scarer, game:event.game, stat:event.data.attackingWith});
            }

            const toSend = new ScareAction({
                scaredPos:event.data.scaredPos,
                scarerPos:event.data.scarerPos,
                scaredSide:other(side),
                attackingWith:event.data.attackingWith,
                failed:!(scarer.cardData.stat(event.data.attackingWith)! >= scared.cardData.stat(getVictim(event.data.attackingWith))!)
            });
            scarer.hasAttacked=true;
            sideTernary(scared.side, event.game.fieldsA, event.game.fieldsB)[event.data.scaredPos-1]=undefined;

            for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                user.send(toSend);
            }

            const action = scared.cardData.getAction(CardActionType.AFTER_SCARED);
            if(action !== undefined) action({self:scared, scarer, game:event.game, stat:event.data.attackingWith});

            endTurn(event.game);
        }
    }else if(event instanceof CardAction){
        if(event.game !== undefined) {
            switch(event.data.actionName){
                case CardActionOptions.BROWNIE_DRAW: {
                    const id = (event as CardAction<{ id: number }>).data.cardData.id;
                    const card = event.game.cards.values().find(card => card.id === id);
                    if (event.game.state instanceof PickCardsState &&//player is picking cards
                        card && event.game.player(card.side) === event.sender &&//card exists and card belongs to sender
                        card.cardData.level === 1 && card.cardData.getAction(CardActionType.IS_FREE)&&//and card is level 1 and card is free
                        event.game.player(event.game.state.parentState.turn) === event.sender){//it is the senders turn
                        findAndRemove(event.game, card);
                        sideTernary(card.side, event.game.handA, event.game.handB).push(card);
                        event.game.state = event.game.state.parentState;//this might be wrong perchance

                        for(const user of (usersFromGameIDs[event.game.gameID]||[])){
                            if(user !== event.sender){
                                user.send(new CardAction({
                                    cardId: -1,
                                    actionName:CardActionOptions.BROWNIE_DRAW,
                                    cardData:{id:card.id},
                                }))
                            }
                        }
                    }
                }break;
            }
        }
    }else if(event instanceof DiscardEvent){
        if(event.game !== undefined) {
            let side: Side | undefined = undefined;//the side of the player discarding
            if (event.sender === event.game.player(Side.A)) {
                side = Side.A;
            } else if (event.sender === event.game.player(Side.B)) {
                side = Side.B;
            }
            if (side === undefined) return rejectEvent(event);

            const hand = sideTernary(side, event.game.handA, event.game.handB);
            const toDiscard = hand.find(card => card.id === event.data.which);
            if (!(event.game.state instanceof TurnState &&
                event.sender === event.game.player(event.game.state.turn) &&//if its the player's turn
                toDiscard !== undefined&&//the card exists AND is in the player's hand
                hand.length>5)) {//the player is in a position to discard
                rejectEvent(event);
                return;
            }

            sideTernary(side, event.game.runawayA, event.game.runawayB).push(
                hand.splice(hand.indexOf(toDiscard),1)[0]!);
            acceptEvent(event);
        }
    }else if(event instanceof ClarifyCardEvent){
        if(event.game !== undefined){
            let shouldClarify:string|undefined=undefined;
            switch(event.data.justification){
                case ClarificationJustification.BROWNIE:
                    if(event.game.state instanceof TurnState &&
                        event.sender === event.game.player(event.game.state.turn) &&
                        sideTernary(event.game.state.turn, event.game.handA, event.game.handB)
                            .find(card =>card.cardData.name === "og-005")) {

                        shouldClarify = sideTernary(event.game.state.turn, event.game.deckA, event.game.deckB)
                            .find(card => card.id === event.data.id &&
                                card.cardData.level === 1 && card.cardData.getAction(CardActionType.IS_FREE) !== undefined)?.cardData.name;
                        //should remember that the player clarified cards with the purpose of seeing them with brownie, so the next card they place should be brownie
                    }
                    break;
            }

            if(shouldClarify !== undefined){
                network.replyToClient(event, new ClarifyCardEvent({
                    id:event.data.id,
                    cardDataName:shouldClarify
                }));
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

network.sendToClients = (event) => {
    for(const user of (usersFromGameIDs[event.game!.gameID]||[])){
        user.send(event);
    }
}
network.receiveFromClient= async (packed, client) => {
    await wait(50);

    //todo: this smells like vulnerability
    // @ts-ignore
    const event = new Events[packed.type](packed.data, gamesFromUser.get(client), client, packed.id) as Event<any>;
    if(true) console.log("received "+event.serialize());

    if(event.game !== undefined && (eventReplyIds[event.game.gameID]||{})[event.id] !== undefined){
        ((eventReplyIds[event.game.gameID]||{})[event.id]?._callback||(()=>{}))(event);
        return;
    }

    parseEvent(event, client);
}
network.replyToClient = (replyTo, replyWith) => {
    replyTo.sender?.send(replyWith);
    return new Replyable(replyWith);
}
