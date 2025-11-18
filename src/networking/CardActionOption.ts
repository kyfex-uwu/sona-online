import {Side} from "../GameElement.js";
import {verifyNoDuplicateStrVals} from "../consts.js";

export type BOTTOM_DRAW={ side: Side };
export type K9_ALPHA={ canineFields: [boolean, boolean, boolean] };
export type BROWNIE_DRAW={ id: number };
export type GREMLIN_SCARE={ id?: number };
export type WORICK_RESCUE={ id: number };
export type AMBER_PICK=1 | 2;
export type FURMAKER_PICK=number;
export type YASHI_REORDER=[number?, number?, number?];
export type DCW_GUESS=number;

export type CardActionOption<T> = {};
export const CardActionOptions = {
    K9_ALPHA: "og-001_alpha" as CardActionOption<K9_ALPHA>,
    BROWNIE_DRAW: "og-005_draw" as CardActionOption<BROWNIE_DRAW>,
    GREMLIN_SCARE: "og-009_scare" as CardActionOption<GREMLIN_SCARE>,
    AMBER_PICK: "og-018_pick" as CardActionOption<AMBER_PICK>,
    BOTTOM_DRAW: "og-025_bottom_draw" as CardActionOption<BOTTOM_DRAW>,
    YASHI_REORDER: "og-027_reorder" as CardActionOption<YASHI_REORDER>,
    DCW_GUESS: "og-032_guess" as CardActionOption<DCW_GUESS>,
    WORICK_RESCUE: "og-038_rescue" as CardActionOption<WORICK_RESCUE>,
    FURMAKER_PICK: "og-041_pick" as CardActionOption<FURMAKER_PICK>,
};
verifyNoDuplicateStrVals(CardActionOptions, "Duplicate card action");
