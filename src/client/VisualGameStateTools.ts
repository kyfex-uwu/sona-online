import {newHighlightLock} from "./VisualCard.js";
import {VisualGameState} from "./VisualGameStates.js";

export enum StateFeatures {
    FIELDS_PLACEABLE,
    FIELDS_SELECTABLE,
    ALL_FIELDS_SELECTABLE,
    DECK_DRAWABLE,
    CAN_DISCARD_FROM_HAND,
} //todo: i think theres only gonna be 2 cancellable states? (attacking and pick+subclasses) so do we really need this

export const canSelectCardHighlight = newHighlightLock();

export interface Cancellable {
    isCancellable(): boolean;

    end(): void;
}

export const isCancellable = (inst: any) => inst.isCancellable instanceof Function && inst.end instanceof Function;

export enum EndType {
    CANCEL,
    FINISH,
    BOTH,
    NONE
}