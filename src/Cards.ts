import CardData, {CardTriggerType, Species, Temperament} from "./CardData.js";
import {sideTernary} from "./consts.js";
import {BeforeGameState, TurnState} from "./GameStates.js";
import Card, {CardMiscDataStrings, getVictim} from "./Card.js";
import {GameMiscDataStrings} from "./Game.js";
import {CardActionOptions} from "./networking/CardActionOption.js";
import {other} from "./GameElement.js";

const cards:{[k:string]:CardData} = {};

const setCard = (data:CardData) => cards[data.name] = data;

export const addTempStats = (self:Card, toAdd:[number|undefined,number|undefined,number|undefined]) =>{
    for(const upgrade of Object.values(self.getMiscData(CardMiscDataStrings.TEMP_STAT_UPGRADES)!))
        for(let i=0;i<3;i++)
            if(toAdd[i] !== undefined)
                toAdd[i]! += upgrade[i]!;

    return toAdd;
}

//--

// setCard(new CardData("supporters-001",[undefined,undefined,undefined],2,Species.VULPES, Temperament.DOMESTIC, "supporters/001.jpg"));
// setCard(new CardData("supporters-002",[undefined,undefined,undefined],2,Species.UROCYON, Temperament.DOMESTIC, "supporters/002.jpg"));
// setCard(new CardData("supporters-003",[undefined,undefined,undefined],2,Species.UNKNOWN, Temperament.DOMESTIC, "supporters/003.jpg"));

setCard(new CardData("og-001", [6,5,6], 3, Species.CANINE,Temperament.DOMESTIC,"og/001.jpg")
    .with(CardTriggerType.GET_STATS, ({self, game})=>{
        const toReturn:[number|undefined,number|undefined,number|undefined] = [...self.cardData.stats];
        const newStatData = self.getMiscData(CardMiscDataStrings.K9_TEMP_STAT_UPGRADE);
        if(newStatData !== undefined)
            toReturn[newStatData?.stat]=newStatData.newVal;
        return addTempStats(self, toReturn);
    }));
setCard(new CardData("og-002", [9,7,6], 3, Species.CANINE,Temperament.DOMESTIC,"og/002.jpg"));
setCard(new CardData("og-003", [3,3,3], 3, Species.FELINE,Temperament.WILD, "og/003.jpg")
    .with(CardTriggerType.GET_STATS, ({self, game})=>{
        return addTempStats(self, new Array(3).fill(sideTernary(self.side, game.fieldsA, game.fieldsB)
            .filter(c=>c?.cardData.species === Species.FELINE).length*3) as [number,number,number]);
    }));
setCard(new CardData("og-004", [7,9,6], 3, Species.FELINE,Temperament.WILD, "og/004.jpg"));
setCard(new CardData("og-005", [2,2,2], 1, Species.CANINE,Temperament.DOMESTIC, "og/005.jpg"));
setCard(new CardData("og-006", [undefined,2,1], 1, Species.FELINE,Temperament.WILD, "og/006.jpg").setFree());
setCard(new CardData("og-007", [2,1,undefined], 1, Species.CANINE,Temperament.DOMESTIC, "og/007.jpg").setFree());
setCard(new CardData("og-008", [1,undefined,2], 1, Species.CANINE,Temperament.DOMESTIC, "og/008.jpg").setFree());
setCard(new CardData("og-009", [2,1,1], 1, Species.FELINE,Temperament.WILD, "og/009.jpg"));
setCard(new CardData("og-010", [1,2,undefined], 1, Species.CHIROPTERA,Temperament.WILD, "og/010.jpg").setFree());
setCard(new CardData("og-011", [1,2,1], 1, Species.MUSTELOID,Temperament.WILD, "og/011.jpg")
    .with(CardTriggerType.PLACED, ({self, game})=>{
        self.setMiscData(CardMiscDataStrings.TRASH_PANDA_IMMUNITY, "wait");
        game.getMiscData(GameMiscDataStrings.FIRST_TURN_AWAITER)?.resolve();
    })).with(CardTriggerType.TURN_START, ({self, game})=>{
        if(game.state instanceof TurnState &&
            self.getMiscData(CardMiscDataStrings.TRASH_PANDA_IMMUNITY) !== "not immune") {
            if (game.state.turn !== self.side)
                self.setMiscData(CardMiscDataStrings.TRASH_PANDA_IMMUNITY, "immune");
            else
                self.setMiscData(CardMiscDataStrings.TRASH_PANDA_IMMUNITY, "not immune");
        }
    }).with(CardTriggerType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game})=>{
        if(self === scared && self.getMiscData(CardMiscDataStrings.TRASH_PANDA_IMMUNITY) !== "not immune") return true;
    });
setCard(new CardData("og-012", [1,1,1], 1, Species.LAGOMORPH,Temperament.DOMESTIC, "og/012.jpg").setFree());
setCard(new CardData("og-013", [undefined,1,2], 1, Species.FELINE,Temperament.DOMESTIC, "og/013.jpg").setFree());
setCard(new CardData("og-014", [3,6,2], 2, Species.EQUINE,Temperament.DOMESTIC, "og/014.jpg")
    .with(CardTriggerType.SPECIAL_PLACEABLE_CHECK, ({self, game, normallyValid})=>{
        if(game.state instanceof TurnState && game.state.turn !== self.side &&
            sideTernary(self.side, game.fieldsA, game.fieldsB)
            .filter(card=>card!==undefined)
            .length === 0) return true;
        return normallyValid;
    }).with(CardTriggerType.IS_SOMETIMES_FREE, ({self, game})=>{
        return game.state instanceof TurnState &&
            sideTernary(self.side, game.fieldsA, game.fieldsB)
                .filter(card => card !== undefined).length === 0 &&
            (game.state.turn !== self.side || !game.state.drawnToStart);
    }));
setCard(new CardData("og-015", [3,6,3], 3, Species.REPTILE,Temperament.WILD, "og/015.jpg"));
setCard(new CardData("og-016", [6,2,1], 1, Species.AVIAN,Temperament.WILD, "og/016.jpg"));
setCard(new CardData("og-017", [4,3,undefined], 1, Species.FELINE,Temperament.WILD, "og/017.jpg"));
setCard(new CardData("og-018", [3,2,undefined], 1, Species.CANINE,Temperament.DOMESTIC, "og/018.jpg"));
setCard(new CardData("og-019", [undefined,3,4], 1, Species.CANINE,Temperament.DOMESTIC, "og/019.jpg"));
setCard(new CardData("og-020", [3,undefined,2], 1, Species.RODENTIA,Temperament.DOMESTIC, "og/020.jpg"));
setCard(new CardData("og-021", [2,1,6], 1, Species.FELINE,Temperament.DOMESTIC, "og/021.jpg"));
setCard(new CardData("og-022", [undefined,2,3], 1, Species.UNKNOWN,Temperament.DOMESTIC, "og/022.jpg"));
setCard(new CardData("og-023", [5,undefined,undefined], 2, Species.MUSTELOID,Temperament.WILD, "og/023.jpg"));
setCard(new CardData("og-024", [3,2,2], 1, Species.FELINE,Temperament.WILD, "og/024.jpg"));
setCard(new CardData("og-025", [2,3,2], 1, Species.CANINE,Temperament.WILD, "og/025.jpg"));
setCard(new CardData("og-026", [undefined,5,undefined], 2, Species.FELINE,Temperament.WILD, "og/026.jpg"));
setCard(new CardData("og-027", [6,3,5], 2, Species.FELINE,Temperament.DOMESTIC, "og/027.jpg"));
setCard(new CardData("og-028", [4,3,4], 2, Species.CANINE,Temperament.DOMESTIC, "og/028.jpg"));
setCard(new CardData("og-029", [5,5,3], 2, Species.MUSTELOID,Temperament.DOMESTIC, "og/029.jpg"));
setCard(new CardData("og-030", [3,5,6], 2, Species.VULPES,Temperament.DOMESTIC, "og/030.jpg"));
setCard(new CardData("og-031", [2,4,7], 2, Species.VULPES,Temperament.WILD, "og/031.jpg")
    .with(CardTriggerType.CARD_ACTION_CAN_HAPPEN, ({self,game,event})=>{
        return event.data.actionName === CardActionOptions.FOXY_MAGICIAN_PICK || undefined;
    }));
setCard(new CardData("og-032", [4,2,7], 2, Species.FELINE,Temperament.WILD, "og/032.jpg"));
setCard(new CardData("og-033", [2,undefined,1], 1, Species.CANINE,Temperament.DOMESTIC, "og/033.jpg").setFree());
setCard(new CardData("og-034", [undefined,4,6], 2, Species.UNKNOWN,Temperament.WILD, "og/034.jpg"));
setCard(new CardData("og-035", [3,3,3], 2, Species.CANINE,Temperament.DOMESTIC, "og/035.jpg"));
setCard(new CardData("og-036", [6,undefined,4], 2, Species.CANINE,Temperament.WILD, "og/036.jpg"));
setCard(new CardData("og-037", [1,6,2], 1, Species.CANINE,Temperament.DOMESTIC, "og/037.jpg"));
setCard(new CardData("og-038", [6,5,8], 3, Species.MUSTELOID,Temperament.WILD, "og/038.jpg"))
setCard(new CardData("og-039", [4,6,undefined], 2, Species.FELINE,Temperament.WILD, "og/039.jpg"));
setCard(new CardData("og-040", [undefined,undefined,5], 2, Species.CANINE,Temperament.WILD, "og/040.jpg"));
setCard(new CardData("og-041", [1,1,1], 1, Species.UNKNOWN,Temperament.UNKNOWN, "og/041.jpg")
    .with(CardTriggerType.SHOULD_SHOW_HAND, ({self, game})=>{
        return true;
    }));
setCard(new CardData("og-042", [2,2,3], 1, Species.CANINE,Temperament.DOMESTIC, "og/042.jpg")
    .with(CardTriggerType.INTERRUPT_SCARE, ({self, scared, scarer, stat, game, result})=>{
        if(sideTernary(self.side, game.fieldsA, game.fieldsB).findIndex(card=>card?.id === self.id) === undefined)
            return;

        if(scared.cardData.species === Species.CANINE &&
            stat !== "card" && scarer.stat(stat) !== undefined && scared.stat(getVictim(stat)) !== undefined &&
                (scarer.stat(stat)! <= self.stat(getVictim(stat))!)){
            result.determineScare="force_fail";
        }
    }));
setCard(new CardData("og-043", [1,1,2], 1, Species.FELINE,Temperament.WILD, "og/043.jpg")
    .with(CardTriggerType.PRE_PLACED, ({self, game})=>{
        if(game.state instanceof BeforeGameState) {
            game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![other(self.side)] = "first";
            self.setMiscData(CardMiscDataStrings.CLOUD_CAT_ALREADY_PICKED, true);
        }else
            game.setMiscData(GameMiscDataStrings.NEXT_ACTION_SHOULD_BE[self.side], CardActionOptions.CLOUD_CAT_PICK);
    }).with(CardTriggerType.ON_RUNAWAY, ({self, scarer, toRunaway, stat, game})=>{
        if(toRunaway===self) game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![other(self.side)] = false;
    })).with(CardTriggerType.PLACED, ({self, game})=>{
        if(game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![other(self.side)] === "first"){
            game.getMiscData(GameMiscDataStrings.CLOUD_CAT_DISABLED)![other(self.side)] =
                sideTernary(self.side, game.fieldsB, game.fieldsA)
                    .find(card=>card!==undefined)?.id!
        }
    });
setCard(new CardData("og-044", [2,2,2], 2, Species.AMPHIBIAN,Temperament.WILD, "og/044.jpg").setFree());

//--

// setCard(new CardData("og-045",[9,8,8],3,Species.DRACO,Temperament.WILD, "og/045.jpg").setOverweight());
// setCard(new CardData("og-046",[6,3,6],3,Species.RODENTIA,Temperament.TAME, "og/046.jpg"));
// setCard(new CardData("og-047",[4,4,3],2,Species.RODENTIA,Temperament.DOMESTIC, "og/047.jpg"));
// setCard(new CardData("og-048",[2,2,2],2,Species.FELINE,Temperament.WILD, "og/048.jpg")
//     .with(CardTriggerType.GET_STATS, ({self, game})=> {
//         return addTempStats(self, new Array(3).fill(sideTernary(self.side, game.fieldsA, game.fieldsB)
//             .filter(c => c?.cardData.species === Species.FELINE).length * 2) as [number, number, number]);
//     }));
// setCard(new CardData("og-049",[1,2,undefined],1,Species.FELINE,Temperament.WILD, "og/049.jpg").setFree());
// setCard(new CardData("og-050",[1,1,3],1,Species.EQUINE,Temperament.WILD, "og/050.jpg").setFree());
// setCard(new CardData("og-051",[2,2,5],1,Species.LIZARD,Temperament.WILD, "og/051.jpg"));
// setCard(new CardData("og-052",[4,4,7],2,Species.VULPES,Temperament.WILD, "og/052.jpg"));
// setCard(new CardData("og-053",[undefined,6,4],2,Species.CANINE,Temperament.DOMESTIC, "og/053.jpg"));
// setCard(new CardData("og-054",[3,3,3],1,Species.UNKNOWN,Temperament.WILD, "og/054.jpg"));
// setCard(new CardData("og-055",[2,2,2],1,Species.AMPHIBIAN,Temperament.WILD, "og/055.jpg"));
// setCard(new CardData("og-056",[3,4,4],2,Species.VULPES,Temperament.WILD, "og/056.jpg"));
// setCard(new CardData("og-057",[3,undefined,4],1,Species.BOVIDAE,Temperament.DOMESTIC, "og/057.jpg"));
// setCard(new CardData("og-058",[6,7,9],3,Species.XENARTHRA,Temperament.WILD, "og/058.jpg"));
// setCard(new CardData("og-059",[1,1,1],1,Species.MUSTELOID,Temperament.TAME, "og/059.jpg"));
// setCard(new CardData("og-060",[2,undefined,1],1,Species.FELINE,Temperament.DOMESTIC, "og/060.jpg").setFree());
// setCard(new CardData("og-061",[1,2,undefined],1,Species.CANINE,Temperament.DOMESTIC, "og/061.jpg").setFree());
// setCard(new CardData("og-062",[1,3,3],1,Species.MUSTELOID,Temperament.DOMESTIC, "og/062.jpg"));
// setCard(new CardData("og-063",[4,4,1],1,Species.UNKNOWN,Temperament.WILD, "og/063.jpg"));
// setCard(new CardData("og-064",[3,3,1],1,Species.MUSTELOID,Temperament.FERAL, "og/064.jpg"));
// setCard(new CardData("og-065",[undefined,3,undefined],1,Species.FELINE,Temperament.TAME, "og/065.jpg"));
// setCard(new CardData("og-066",[3,3,3],2,Species.UNKNOWN,Temperament.UNKNOWN, "og/066.jpg"));
// setCard(new CardData("og-067",[3,6,5],2,Species.CANINE,Temperament.DOMESTIC, "og/067.jpg"));
// setCard(new CardData("og-068",[3,undefined,undefined],1,Species.CANINE,Temperament.DOMESTIC, "og/068.jpg"));
// setCard(new CardData("og-069",[7,4,4],2,Species.BOVIDAE,Temperament.DOMESTIC, "og/069.jpg"));
// setCard(new CardData("og-070",[7,2,4],2,Species.FISH,Temperament.WILD, "og/070.jpg"));
// setCard(new CardData("og-071",[undefined,8,5],3,Species.EQUINE,Temperament.DOMESTIC, "og/071.jpg"));
// setCard(new CardData("og-072",[8,5,undefined],3,Species.URSIDAE,Temperament.WILD, "og/072.jpg"));
// setCard(new CardData("og-073",[3,undefined,0],1,Species.AVES,Temperament.WILD, "og/073.jpg").setFree());
// setCard(new CardData("og-074",[undefined,3,0],1,Species.FISH,Temperament.DOMESTIC, "og/074.jpg").setFree());
// setCard(new CardData("og-075",[4,7,4],2,Species.SUIDAE,Temperament.DOMESTIC, "og/075.jpg"));
// setCard(new CardData("og-076",[1,4,4],1,Species.FELINE,Temperament.DOMESTIC, "og/076.jpg"));
// setCard(new CardData("og-077",[2,2,2],1,Species.LAGOMORPH,Temperament.DOMESTIC, "og/077.jpg").setFree());
// setCard(new CardData("og-078",[undefined,undefined,3],1,Species.MUSTELOID,Temperament.WILD, "og/078.jpg"));
// setCard(new CardData("og-079",[3,5,5],2,Species.AMPHIBIAN,Temperament.WILD, "og/079.jpg"));
// setCard(new CardData("og-080",[4,undefined,6],2,Species.CERVIDAE,Temperament.WILD, "og/080.jpg"));
// setCard(new CardData("og-081",[4,4,1],1,Species.CERVIDAE,Temperament.WILD, "og/081.jpg"));
// setCard(new CardData("og-082",[2,5,2],1,Species.SERPENT,Temperament.WILD, "og/082.jpg"));
// setCard(new CardData("og-083",[4,1,4],1,Species.CANINE,Temperament.DOMESTIC, "og/083.jpg"));
// setCard(new CardData("og-084",[8,8,9],3,Species.AVES,Temperament.DOMESTIC, "og/084.jpg").setOverweight());
// setCard(new CardData("og-085",[0,0,0],"?",Species.UNKNOWN,Temperament.UNKNOWN, "og/085.jpg"));
// setCard(new CardData("og-086",[2,3,6],2,Species.PRIMATE,Temperament.TAME, "og/086.jpg"));
// setCard(new CardData("og-087",[7,6,9],3,Species.CANINE,Temperament.DOMESTIC, "og/087.jpg"));
// setCard(new CardData("og-088",[5,8,6],3,Species.EQUINE,Temperament.TAME, "og/088.jpg"));

//--

export const specialCards = new Set<string>([]);
function setSpecialCard(data:CardData){
    setCard(data);
    specialCards.add(data.name);
}
setSpecialCard(new CardData("unknown", [0,0,0], 1, Species.UNKNOWN,Temperament.UNKNOWN, "unknown.jpg"));
setSpecialCard(new CardData("utility", [0,0,0], 1, Species.UNKNOWN,Temperament.UNKNOWN, "utility.png"));

export default cards;
