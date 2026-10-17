import {
    type Event
} from "../Events.js";
import type {Client} from "./BackendServer.js";

import {Side} from "../../consts.js";
import {
    type dataShape, type dataShapeString,
    SerializableEventNames, SerializableEvents,
    SerializableEventShapes,
    ShapeKeywords
} from "../SerializableShapeConsts.js";

const shapeKeywordsValues = Object.values(ShapeKeywords);
export function validateShape(data:any, shape:dataShape[""], orig:dataShape[""]=shape):true|string{
    if (Array.isArray(shape)) {
        if (!shape.includes(data)) return `${JSON.stringify(shape)} does not include ${JSON.stringify(data)}`;
    } else if (typeof shape === "string") {
        let vals = [data];
        if (shape.startsWith("array")) {
            vals = data;
            shape = shape.slice("array".length) as dataShapeString;
        }
        switch (shape) {
            case "string":
                if (vals.some(v => typeof v !== "string")) return `${JSON.stringify(vals)} are not all strings`;
                break;
            case "boolean":
                if (vals.some(v => typeof v !== "boolean")) return `${JSON.stringify(vals)} are not all booleans`;
                break;
            case "number":
                if (vals.some(v => typeof v !== "number")) return `${JSON.stringify(vals)} are not all numbers`;
                break;
            case "cardpos":
                if(vals.some(v=>!(Array.isArray(v) && v.length === 2 && v[0] in {1:1,2:2,3:3} && v[1] in {[Side.A]:0,[Side.B]:0})))
                    return `${JSON.stringify(vals)} are not all card positions`;
                break;
        }
    } else if (typeof shape === "function") {
        const error = shape(data, orig);
        if (typeof error === "string") return `${JSON.stringify(data)} did not pass custom validation: ${error}`;
    } else {
        for(const key in shape) {
            let toCheck = data[key]===undefined?[]:[data[key]];

            if (key !== ShapeKeywords.ALL_NUMBERS) {
                if (!(key in data) && !key.endsWith("?")) return `required value ${key} not found`;
            } else {
                toCheck = Object.keys(data).filter(v => !isNaN(parseInt(v))).map(v =>
                    data[v]);
            }

            for(const value of toCheck) {
                const error = validateShape(value, shape[key]!, orig)
                if (typeof error === "string") return error;
            }

            const allowedKeys = Object.keys(shape)
                .filter(v=>!shapeKeywordsValues.includes(v))
                .map(v=>v.endsWith("?")?v.slice(0,-1):v);
            for(const key in data){
                if(!isNaN(parseInt(key)) && ShapeKeywords.ALL_NUMBERS in shape) continue;
                if(!allowedKeys.includes(key)) return `extra key ${key} found`;
            }
        }
    }

    return true;
}

export function inflate(data:any, client:Client){
    if(!("type" in data) || !SerializableEventNames.has(data.type) || SerializableEvents[data.type] === undefined) return `no event of name ${data.type} found`;

    const shape = SerializableEventShapes[data.type];
    if(!shape) return `no event of name ${data.type} found`;
    const error = validateShape(data.data, shape);
    if(typeof error === "string") return error;
    return new SerializableEvents[data.type]!(
        //@ts-expect-error
        data.data, client, data.id
    ) as Event<any>;
}

