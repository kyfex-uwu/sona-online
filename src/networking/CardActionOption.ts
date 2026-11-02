import {enumValues, Side, Stat, verifyNoDuplicateStrVals} from "../consts.js";
import {type CardPos} from "../Card.js";
import type {Level} from "../CardData.js";
import type {dataShape} from "./SerializableShapeConsts.js";
import {validateShape} from "./backend/EventInflator.js";

export type K9_ALPHA={ canineFields: [boolean, boolean, boolean], attack:1|2|3, attackWith:Stat };
export type BROWNIE_DRAW=number;//id
export type GREMLIN_SCARE=1|2|3|"pass";
export type AMBER_PICK="keep_1"|"keep_2"
export type LUPINE_DRAW_S2C = Side;
export type YASHI_REORDER=[number?, number?, number?];//id
export type WORICK_RESCUE=number;//id
export type FURMAKER_PICK=number;//id
export type CLOUD_CAT_PICK=1|2|3;
export type KIBBY_SCARE=[number, number, number];//id
export type FOXY_MAGICIAN_PICK=number;//id
export type DCW_PICK=number;//id
export type FOXY_MAGICIAN_SHOULD_GUESS=number;//id
export type DCW_SHOULD_GUESS=number;//id
export type FOXY_MAGICIAN_GUESS=Level;
export type DCW_GUESS=Level;
export type DCW_SCARE={side:Side,pos:1|2|3};
export type LITTLEBOSS_IMMUNITY=boolean;
export type COWGIRL_COYOTE_INCREASE = {data?:{ stat:Stat, pos:CardPos, otherPos?:CardPos }}
export type BROY_WEASLA_INCREASE = {data?:{ stat:Stat, pos:CardPos, otherPos?:CardPos }}
export type NOBLE_SHOULD_RETARGET = boolean
export type NOBLE_RETARGET_REQUEST = {scarer:CardPos,scared:CardPos,stat:Stat|"card"}

export type CardActionOption<T> = {};
export const CardActionOptions = {
    K9_ALPHA: "og-001_alpha" as CardActionOption<K9_ALPHA>,
    BROWNIE_DRAW: "og-005_draw" as CardActionOption<BROWNIE_DRAW>,
    GREMLIN_SCARE: "og-009_scare" as CardActionOption<GREMLIN_SCARE>,
    AMBER_PICK: "og-018_pick" as CardActionOption<AMBER_PICK>,
    LUPINE_DRAW: "og-025_lupine_draw" as CardActionOption<LUPINE_DRAW_S2C>,
    YASHI_REORDER: "og-027_reorder" as CardActionOption<YASHI_REORDER>,
    WORICK_RESCUE: "og-038_rescue" as CardActionOption<WORICK_RESCUE>,
    FURMAKER_PICK: "og-041_pick" as CardActionOption<FURMAKER_PICK>,
    CLOUD_CAT_PICK: "og-043_pick" as CardActionOption<CLOUD_CAT_PICK>,
    KIBBY_SCARE: "og-028_scare" as CardActionOption<KIBBY_SCARE>,
    FOXY_MAGICIAN_PICK: "og-031_pick" as CardActionOption<FOXY_MAGICIAN_PICK>,
    FOXY_SHOULD_GUESS:"og-031_shouldguess" as CardActionOption<FOXY_MAGICIAN_SHOULD_GUESS>,
    FOXY_MAGICIAN_GUESS: "og-031_guess" as CardActionOption<FOXY_MAGICIAN_GUESS>,
    DCW_PICK: "og-032_pick" as CardActionOption<DCW_PICK>,
    DCW_SHOULD_GUESS:"og-032_shouldguess" as CardActionOption<DCW_SHOULD_GUESS>,
    DCW_GUESS: "og-032_guess" as CardActionOption<DCW_GUESS>,
    DCW_SCARE: "og-032_scare" as CardActionOption<DCW_SCARE>,
    LITTLEBOSS_IMMUNITY: "og-015_immunity" as CardActionOption<LITTLEBOSS_IMMUNITY>,
    COWGIRL_COYOTE_INCREASE: "og-035_increase" as CardActionOption<COWGIRL_COYOTE_INCREASE>,
    BROY_WEASLA_INCREASE: "og-029_increase" as CardActionOption<BROY_WEASLA_INCREASE>,
    NOBLE_RETARGET_REQUEST: "og-020_retarget_req" as CardActionOption<NOBLE_RETARGET_REQUEST>,
    NOBLE_SHOULD_RETARGET: "og-020_should_retarget" as CardActionOption<NOBLE_SHOULD_RETARGET>,

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
    BROWNIE_DRAW: "number",
    GREMLIN_SCARE: [1,2,3,"pass"],
    AMBER_PICK: ["keep_1","keep_2"],
    LUPINE_DRAW: enumValues(Side),
    YASHI_REORDER: "arraynumber",
    WORICK_RESCUE: "number",
    FURMAKER_PICK: "number",
    CLOUD_CAT_PICK: [1, 2, 3],
    KIBBY_SCARE: "arraynumber",
    FOXY_MAGICIAN_PICK: "number",
    FOXY_SHOULD_GUESS: "number",
    FOXY_MAGICIAN_GUESS: {level:[1, 2, 3],target:"number"},
    DCW_PICK: "number",
    DCW_SHOULD_GUESS: "number",
    DCW_GUESS: {level:[1, 2, 3],target:"number"},
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
    NOBLE_RETARGET_REQUEST: {
        scarer: "cardpos",
        scared: "cardpos",
        stat: enumValues(Stat),
    },
    NOBLE_SHOULD_RETARGET: "boolean",

    //for completeness
    CANNOT_PLAY: {}
}
export function cardActionValidator(data: any, orig: dataShape[""]) {
    return validateShape(data, CardActionOptionValidator[data.actionName as keyof typeof CardActionOptions], orig);
}

