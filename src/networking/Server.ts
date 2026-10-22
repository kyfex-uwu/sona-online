import {AcceptEvent, Event, PerchanceEvent, RejectEvent} from "./Events.js";

class FlagData{
    type:"number"|"boolean";
    val;

    constructor(type:"number"|"boolean", defaultVal:any) {
        this.type=type;
        this.val=defaultVal;
    }

}
type flagName<T>={}
export const flagNames={
    CHILI_MAMA_ALL_CANINES:"CHILI_MAMA_ALL_CANINES" as flagName<boolean>
}
export const flags = {
    [flagNames.CHILI_MAMA_ALL_CANINES as string]:new FlagData("boolean", false),
};
export function getFlag<T>(name:flagName<T>){
    return flags[name as string]!.val as T;
}

export function eventReply(){
    const data:{success?: () => void, fail?: () => void, finally?: () => void} = {};
    const toReturn = (event:Event<any>) =>{
        if(event instanceof PerchanceEvent) return;

        if(event instanceof AcceptEvent && data.success) data.success();
        else if(event instanceof RejectEvent && data.fail) data.fail();
        if(data.finally) data?.finally();
    }
    toReturn.success = (callback:()=>void)=> {
        data.success = callback;
        return toReturn;
    };
    toReturn.fail = (callback:()=>void)=> {
        data.fail = callback;
        return toReturn;
    };
    toReturn.finally = (callback:()=>void)=> {
        data.finally = callback;
        return toReturn;
    };
    return toReturn;
}
export function cancelCallback(callback: () => void, finaly?:()=>void){
    return (event:Event<any>) =>{
        if(event instanceof RejectEvent) callback();
        if(finaly !== undefined) finaly();
    }
}
