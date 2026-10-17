import {enumValues, Side, Stat, verifyNoDuplicateStrVals} from "../consts.js";
import {type CardPos} from "../Card.js";
import type {Level} from "../CardData.js";
import type {dataShape} from "./SerializableShapeConsts.js";
import {validateShape} from "./backend/EventInflator.js";

export enum AmberData{
    KEEP_FIRST,
    KEEP_SECOND
}

export type BOTTOM_DRAW={ side: Side };
export type K9_ALPHA={ canineFields: [boolean, boolean, boolean], attack:1|2|3, attackWith:Stat };
export type BROWNIE_DRAW={ id: number };
export type GREMLIN_SCARE={ position?: 1|2|3 };
export type WORICK_RESCUE={ id: number, side?:Side };
export type AMBER_PICK= {which: AmberData, side?:Side };
export type FURMAKER_PICK= { id:number, side?:Side };
export type YASHI_REORDER={cards:[number?, number?, number?], side?:Side};
export type CLOUD_CAT_PICK=1|2|3;
export type KIBBY_SCARE={cards:[number, number, number], side?:Side};
export type FOXY_MAGICIAN_PICK=number;
export type DCW_PICK=number;
export type FOXY_MAGICIAN_GUESS= Level|undefined;
export type DCW_GUESS=Level|undefined;
export type DCW_SCARE={side:Side,pos:1|2|3};
export type LITTLEBOSS_IMMUNITY=boolean;
export type COWGIRL_COYOTE_INCREASE = {data?:{ stat:Stat, pos:CardPos, otherPos?:CardPos }}
export type BROY_WEASLA_INCREASE = {data?:{ stat:Stat, pos:CardPos, otherPos?:CardPos }}
export type NOBLE_RETARGET = {data?:{scarer:CardPos,scared:CardPos,stat:Stat}, redirect?:boolean}

export type CardActionOption<T> = {};
export const CardActionOptions = {
    K9_ALPHA: "og-001_alpha" as CardActionOption<K9_ALPHA>,
    BROWNIE_DRAW: "og-005_draw" as CardActionOption<BROWNIE_DRAW>,
    GREMLIN_SCARE: "og-009_scare" as CardActionOption<GREMLIN_SCARE>,
    AMBER_PICK: "og-018_pick" as CardActionOption<AMBER_PICK>,
    BOTTOM_DRAW: "og-025_bottom_draw" as CardActionOption<BOTTOM_DRAW>,
    YASHI_REORDER: "og-027_reorder" as CardActionOption<YASHI_REORDER>,
    WORICK_RESCUE: "og-038_rescue" as CardActionOption<WORICK_RESCUE>,
    FURMAKER_PICK: "og-041_pick" as CardActionOption<FURMAKER_PICK>,
    CLOUD_CAT_PICK: "og-043_pick" as CardActionOption<CLOUD_CAT_PICK>,
    KIBBY_SCARE: "og-028_scare" as CardActionOption<KIBBY_SCARE>,
    FOXY_MAGICIAN_PICK: "og-031_pick" as CardActionOption<FOXY_MAGICIAN_PICK>,
    DCW_PICK: "og-032_pick" as CardActionOption<DCW_PICK>,
    FOXY_MAGICIAN_GUESS: "og-031_guess" as CardActionOption<FOXY_MAGICIAN_GUESS>,
    DCW_GUESS: "og-032_guess" as CardActionOption<DCW_GUESS>,
    DCW_SCARE: "og-032_scare" as CardActionOption<DCW_SCARE>,
    LITTLEBOSS_IMMUNITY: "og-015_immunity" as CardActionOption<LITTLEBOSS_IMMUNITY>,
    COWGIRL_COYOTE_INCREASE: "og-035_increase" as CardActionOption<COWGIRL_COYOTE_INCREASE>,
    BROY_WEASLA_INCREASE: "og-029_increase" as CardActionOption<BROY_WEASLA_INCREASE>,
    NOBLE_RETARGET: "og-020_retarget" as CardActionOption<NOBLE_RETARGET>,

    //dont send this one
    CANNOT_PLAY: "cannot_play" as CardActionOption<void>
};
verifyNoDuplicateStrVals(CardActionOptions, "Duplicate card action");

export const CardActionOptionValidator: { [k in keyof typeof CardActionOptions]: dataShape[""] } = {
    K9_ALPHA: {
        canineFields: "arrayboolean",
        attack: [1, 2, 3],
        attackWith: enumValues(Stat),
    },
    BROWNIE_DRAW: {id: "number"},
    GREMLIN_SCARE: {"position?": [1, 2, 3]},
    AMBER_PICK: {
        which: enumValues(AmberData),
        "side?": enumValues(Side)
    },
    BOTTOM_DRAW: {side: enumValues(Side)},
    YASHI_REORDER: {
        cards: "arraynumber",
        "side?": enumValues(Side)
    },
    WORICK_RESCUE: {
        id: "number",
        "side?": enumValues(Side)
    },
    FURMAKER_PICK: {
        id: "number",
        "side?": enumValues(Side)
    },
    CLOUD_CAT_PICK: [1, 2, 3],
    KIBBY_SCARE: {
        cards: "arraynumber",
        "side?": enumValues(Side),
    },
    FOXY_MAGICIAN_PICK: "number",
    DCW_PICK: "number",
    FOXY_MAGICIAN_GUESS: [1, 2, 3, "?", undefined],
    DCW_GUESS: [1, 2, 3, "?", undefined],
    DCW_SCARE: {
        side: enumValues(Side),
        pos: [1, 2, 3]
    },
    LITTLEBOSS_IMMUNITY: "boolean",
    COWGIRL_COYOTE_INCREASE: {
        "data?": {
            stat: enumValues(Stat),
            pos: "cardpos",
            "otherPos?": "cardpos",
        }
    },
    BROY_WEASLA_INCREASE: {
        "data?": {
            stat: enumValues(Stat),
            pos: "cardpos",
            "otherPos?": "cardpos",
        }
    },
    NOBLE_RETARGET: {
        "data?": {
            scarer: "cardpos",
            scared: "cardpos",
            stat: enumValues(Stat),
        },
        "redirect?": "boolean"
    },

    //for completeness
    CANNOT_PLAY: {}
}
export function cardActionValidator(data: any, orig: dataShape[""]) {
    return validateShape(data, CardActionOptionValidator[data.actionName as keyof typeof CardActionOptions], orig);
}

