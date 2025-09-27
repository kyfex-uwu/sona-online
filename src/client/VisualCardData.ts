import CardData, {CardActionType} from "../CardData.js";

export function loadFrontendWrappers(){}

function wrap<P extends { [k: string]: any; }, R>(data:CardData, action:CardActionType<P, R>, wrapper:(orig:((params:P)=>R)|undefined, args:P)=>R){
    const oldAction = data.getAction(action);
    data.with(action, (args: P) => {
        return wrapper(oldAction, args);
    });
}
