import type {Event} from "./Events.js";

export const SerializableEvents: { [k: string]: { new(): Event<any> } } = {};
export type dataShapeString =
    `${"array" | ""}${"number" | "string" | "boolean" | "cardpos"}`
    | ((data: any, orig: dataShape[""]) => true|string)
export type dataShape = { [k: string]: dataShapeString | dataShape | any[] }
export const SerializableEventShapes: { [k: string]: dataShape } = {};
export const SerializableEventNames = new Set<string>();
export const ShapeKeywords = {
    ALL_NUMBERS: "__allNumbers",
}