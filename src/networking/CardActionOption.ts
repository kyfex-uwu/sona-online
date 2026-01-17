import {Side} from "../GameElement.js";
import {verifyNoDuplicateStrVals} from "../consts.js";
import type {Stat} from "../Card.js";
import type {Level} from "../CardData.js";

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
export type KIBBY_SCARE={cards:[number|false, number|false, number|false], side?:Side};
export type FOXY_MAGICIAN_PICK=Level;
export type DCW_PICK=Level;
export type FOXY_MAGICIAN_GUESS=Level;
export type DCW_GUESS=Level;
export type DCW_SCARE={side:Side,pos:1|2|3};
export type LITTLEBOSS_IMMUNITY=boolean;
export type COWGIRL_COYOTE_INCREASE = false|Stat;
export type BROY_WEASLA_INCREASE = false| { stat:Stat, pos:[1|2|3,Side] };
export type SONIC_STALLION_SAVE = false | 1|2|3;

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
    SONIC_STALLION_SAVE: "og-014_save" as CardActionOption<SONIC_STALLION_SAVE>,

    //dont send this one
    CANNOT_PLAY: "cannot_play" as CardActionOption<void>
};
verifyNoDuplicateStrVals(CardActionOptions, "Duplicate card action");
