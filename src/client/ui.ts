import p5 from "p5";

const drawCallbacks:{[k:number]:Array<(p5:any, scale:number)=>void>} = {};
export function registerDrawCallback(layer:number, callback:(p5:any, scale:number)=>void){
    drawCallbacks[layer]=drawCallbacks[layer]||[];
    drawCallbacks[layer].push(callback);
    return ()=>{
        const index = (drawCallbacks[layer]||[]).indexOf(callback);
        if(index!==-1) drawCallbacks[layer]!.splice(index,1);
    }
}

//top 10 worst code snippets ever
const oldLog = console.log;
console.log = function(...args){
    if(typeof args[0] === "string" && (
        args[0].startsWith("🌸 p5.js says:") ||
        args[0].startsWith("Zod error object"))) return;
    oldLog(...args);
}

new p5(p => {
    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
    };
    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    }

    p.draw = () => {
        p.clear();

        const scale = Math.min(p.windowWidth/4,p.windowHeight/3);
        for(const callbackList of Object.entries(drawCallbacks)
            .toSorted((e1, e2)=>parseFloat(e1[0])-parseFloat(e2[0]))){
            for(const callback of callbackList[1]) callback(p, scale);
        }
    };
}, document.getElementById("uiLayer")!);

