import CardData, {CardActionType, InterruptScareResult, Species} from "./CardData.js";
import {sideTernary} from "./consts.js";
import {TurnState} from "./GameStates.js";
import {getVictim, MiscDataStrings, Stat} from "./Card.js";
import {flagNames, getFlag} from "./networking/Server.js";
import {GameMiscDataStrings} from "./Game.js";
import {CardActionOptions} from "./networking/CardActionOption.js";

const cards:{[k:string]:CardData} = {};

const setCard = (data:CardData) => cards[data.name] = data;

setCard(new CardData("og-001", [5,5,5], 3, Species.CANINE)//todo
    .with(CardActionType.LAST_ACTION, ({self, game})=>{
        game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.K9_ALPHA);
    })
    .with(CardActionType.GET_STATS, ({self, game})=>{
        const toReturn = [...self.cardData.stats];
        const newStatData = self.getMiscData(MiscDataStrings.K9_TEMP_STAT_UPGRADE);
        if(newStatData !== undefined)
            toReturn[newStatData?.stat]=newStatData.newVal;
        return toReturn;
    }));
setCard(new CardData("og-002", [9,7,5], 3, Species.CANINE));
setCard(new CardData("og-003", [3,3,3], 3, Species.FELINE)//DONE
    .with(CardActionType.GET_STATS, ({self, game})=>{
        return new Array(3).fill(sideTernary(self.side, game.fieldsA, game.fieldsB)
            .filter(c=>c?.cardData.species === Species.FELINE).length*3);
    }));
setCard(new CardData("og-004", [7,9,5], 3, Species.FELINE));
setCard(new CardData("og-005", [2,2,2], 1, Species.CANINE)//done only here
    .with(CardActionType.PLACED, ({self, game})=>{
        game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.BROWNIE_DRAW);
    }));
setCard(new CardData("og-006", [undefined,2,1], 1, Species.FELINE).setFree());
setCard(new CardData("og-007", [2,1,undefined], 1, Species.CANINE).setFree());
setCard(new CardData("og-008", [1,undefined,2], 1, Species.CANINE).setFree());
setCard(new CardData("og-009", [2,2,2], 1, Species.FELINE)
    .with(CardActionType.PLACED, ({self, game})=>{
        game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.GREMLIN_SCARE);
    }));
setCard(new CardData("og-010", [1,2,undefined], 1, Species.BAT).setFree());
setCard(new CardData("og-011", [1,3,1], 1, Species.MUSTELOID)//todo
    .with(CardActionType.PLACED, ({self, game})=>{
        self.setMiscData(MiscDataStrings.TRASH_PANDA_IMMUNITY, "wait");
    })).with(CardActionType.TURN_START, ({self, game})=>{
        if(game.state instanceof TurnState) {
            if (game.state.turn !== self.side)
                self.setMiscData(MiscDataStrings.TRASH_PANDA_IMMUNITY, "immune");
            else self.setMiscData(MiscDataStrings.TRASH_PANDA_IMMUNITY, "not immune");
        }
    }).with(CardActionType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(self!==scared) return InterruptScareResult.PASSTHROUGH;

        if(self.getMiscData(MiscDataStrings.TRASH_PANDA_IMMUNITY) !== "not immune") return InterruptScareResult.PREVENT_SCARE;
    return InterruptScareResult.PASSTHROUGH;
    });
setCard(new CardData("og-012", [1,1,1], 1, Species.LAGOMORPH).setFree());
setCard(new CardData("og-013", [undefined,1,2], 1, Species.FELINE).setFree());
setCard(new CardData("og-014", [4,5,3], 2, Species.EQUINE)//todo
    .with(CardActionType.AFTER_CRISIS, ({self, game})=>{

    }));
setCard(new CardData("og-015", [5,6,5], 3, Species.REPTILE)//todo
    .with(CardActionType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(self!==scared) return InterruptScareResult.PASSTHROUGH;

        if(self.getMiscData(MiscDataStrings.LITTLEBOSS_IMMUNITY) === undefined) {
            self.setMiscData(MiscDataStrings.LITTLEBOSS_IMMUNITY, "not immune");//TODO: optional
            return InterruptScareResult.FAIL_SCARE;
        }else return InterruptScareResult.PASSTHROUGH;
    }));
setCard(new CardData("og-016", [8,2,1], 1, Species.AVIAN));
setCard(new CardData("og-017", [5,3,undefined], 1, Species.FELINE));
setCard(new CardData("og-018", [3,1,undefined], 1, Species.CANINE)//todo
    .with(CardActionType.ACTION, ({self, game})=>{

    }));
setCard(new CardData("og-019", [undefined,3,5], 1, Species.CANINE));
setCard(new CardData("og-020", [3,undefined,2], 1, Species.RODENTIA)//todo
    .with(CardActionType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(self!==scared) return InterruptScareResult.PASSTHROUGH;

        return InterruptScareResult.PASSTHROUGH;
    }));
setCard(new CardData("og-021", [2,1,8], 1, Species.FELINE));
setCard(new CardData("og-022", [undefined,1,3], 1, Species.UNKNOWN)//DONE
    .with(CardActionType.AFTER_SCARED, ({self, scarer, stat, game})=>{
        const toAdd = sideTernary(self.side, game.deckA, game.deckB).pop();
        if(toAdd !== undefined) sideTernary(self.side, game.handA, game.handB).push(toAdd);
    }));
setCard(new CardData("og-023", [5,undefined,undefined], 2, Species.MUSTELOID));
setCard(new CardData("og-024", [3,1,2], 1, Species.FELINE)//DONE
    .with(CardActionType.PLACED, ({self, game})=>{
        const toAdd = sideTernary(self.side, game.deckA, game.deckB).pop();
        if(toAdd !== undefined) sideTernary(self.side, game.handA, game.handB).push(toAdd);
    }));
setCard(new CardData("og-025", [1,3,2], 1, Species.CANINE)//DONE
    .with(CardActionType.PLACED, ({self, game})=>{
        const toAdd = sideTernary(self.side, game.deckA, game.deckB).shift();
        if(toAdd !== undefined) sideTernary(self.side, game.handA, game.handB).push(toAdd);
    }));
setCard(new CardData("og-026", [undefined,5,undefined], 2, Species.FELINE));
setCard(new CardData("og-027", [6,3,5], 2, Species.FELINE)//todo
    .with(CardActionType.PLACED, ({self, game})=>{
        game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.YASHI_REORDER);
    }));
setCard(new CardData("og-028", [4,4,3], 2, Species.CANINE)//todo
    .with(CardActionType.LAST_ACTION, ({self, game})=>{

    }));
setCard(new CardData("og-029", [5,6,3], 2, Species.MUSTELOID)//todo
    .with(CardActionType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(self!==scared) return InterruptScareResult.PASSTHROUGH;

        if(scarer.side === self.side){

        }
        return InterruptScareResult.PASSTHROUGH;
    }));
setCard(new CardData("og-030", [3,5,6], 2, Species.VULPES)//todo
    .with(CardActionType.PLACED, ({self, game})=>{
        for(const data of [{hand:game.handA,deck:game.deckA}, {hand:game.handB,deck:game.deckB}]) {
            while (data.hand.length < 5) {
                const toAdd = data.deck.pop();
                if(toAdd !== undefined) data.hand.push(toAdd);

            }
        }
    }));
setCard(new CardData("og-031", [3,4,7], 2, Species.VULPES)//todo
    .with(CardActionType.PLACED, ({self, game})=>{

    }));
setCard(new CardData("og-032", [4,3,7], 2, Species.FELINE)//todo
    .with(CardActionType.PLACED, ({self, game})=>{
        game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.DCW_GUESS);
    }));
setCard(new CardData("og-033", [2,undefined,1], 1, Species.CANINE).setFree());
setCard(new CardData("og-034", [undefined,5,7], 2, Species.UNKNOWN));
setCard(new CardData("og-035", [3,3,3], 2, Species.CANINE)//todo
    .with(CardActionType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(self!==scared) return InterruptScareResult.PASSTHROUGH;

        if(scarer.side !== self.side){

        }
        return InterruptScareResult.PASSTHROUGH;
    }));
setCard(new CardData("og-036", [7,undefined,5], 2, Species.CANINE));
setCard(new CardData("og-037", [1,8,2], 1, Species.CANINE));
setCard(new CardData("og-038", [6,5,8], 3, Species.MUSTELOID));
setCard(new CardData("og-039", [5,7,undefined], 2, Species.FELINE));
setCard(new CardData("og-040", [undefined,undefined,5], 2, Species.CANINE));
setCard(new CardData("og-041", [1,1,1], 1, Species.UNKNOWN)//todo
    .with(CardActionType.SHOULD_SHOW_HAND, ({self, game})=>{
        return true;
    }));
setCard(new CardData("og-042", [2,2,2], 1, Species.CANINE)//todo
    .with(CardActionType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(getFlag(flagNames.CHILI_MAMA_ALL_CANINES)){
            if(scared.cardData.species !== Species.CANINE) return InterruptScareResult.PASSTHROUGH;
        }else{
            if(scared !== self) return InterruptScareResult.PASSTHROUGH;
        }

        if(stat !== "card" && scarer.cardData.stat(stat) !== undefined && scared.cardData.stat(getVictim(stat)) !== undefined){
            return scarer.cardData.stat(stat)! > self.cardData.stat(getVictim(stat))! ?
                InterruptScareResult.PASSTHROUGH : InterruptScareResult.FAIL_SCARE;
        }
        return InterruptScareResult.PASSTHROUGH;
    }));
setCard(new CardData("og-043", [2,2,2], 1, Species.FELINE)//todo
    .with(CardActionType.PLACED, ({self, game})=>{
        //hoo boy
    }));
setCard(new CardData("og-044", [2,2,2], 2, Species.AMPHIBIAN).setFree());

setCard(new CardData("unknown", [0,0,0], 1, Species.UNKNOWN));
setCard(new CardData("utility", [0,0,0], 1, Species.UNKNOWN, "utility.png"));
setCard(new CardData("temp_red", [0,0,0], 1, Species.UNKNOWN));
setCard(new CardData("temp_blue", [0,0,0], 1, Species.UNKNOWN));
setCard(new CardData("temp_yellow", [0,0,0], 1, Species.UNKNOWN));
export const specialCards = new Set<string>([
    "unknown",
    "utility",
    "temp_red",
    "temp_blue",
    "temp_yellow"
]);

export default cards;
