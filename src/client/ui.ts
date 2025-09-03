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

const assets:{[k:string]:p5.Image} = {};

//top 10 worst code snippets ever
const oldLog = console.log;
console.log = function(...args){
    if(typeof args[0] === "string" && (
        args[0].startsWith("🌸 p5.js says:") ||
        args[0].startsWith("Zod error object"))) return;
    oldLog(...args);
}

const mouseData = {
    down:false,
    wasDown:false,
};
new p5(p => {
    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);

        p.textFont("Red Rose");
        p.loadImage(`/assets/button.png`, (image:p5.Image) => {
            assets["button"] = image;
        });
        p.loadImage(`/assets/button_pressed.png`, (image:p5.Image) => {
            assets["button_pressed"] = image;
        });
    };
    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    }

    p.draw = () => {
        p.clear();
        mouseData.wasDown=mouseData.down;
        mouseData.down=p.mouseIsPressed;

        const scale = Math.min(p.windowWidth/4,p.windowHeight/3);
        for(const callbackList of Object.entries(drawCallbacks)
            .toSorted((e1, e2)=>parseFloat(e1[0])-parseFloat(e2[0]))){
            for(const callback of callbackList[1]) callback(p, scale);
        }
    };
}, document.getElementById("uiLayer")!);

let _buttonId=0;
export function buttonId(){ return _buttonId++; }
const buttonData:{[k:number]:boolean}={};
export function button(p5:any, x:number,y:number,w:number,h:number,text:string,onClick:()=>void, scale:number, buttonId:number){
    if(assets.button === undefined || assets.button_pressed === undefined) return;
    if(buttonData[buttonId] === undefined)
        buttonData[buttonId]=false;

    scale=scale/128/3;
    const isIn=p5.mouseX>=x&&p5.mouseX<=x+w&&p5.mouseY>=y&&p5.mouseY<=y+h;
    const buttonImage = isIn ?
        assets.button_pressed : assets.button;

    //center
    p5.image(buttonImage, x+24*scale-1, y+24*scale-1, w-48*scale+2, h-48*scale+2, 24,24,80,80);

    //edges
    p5.image(buttonImage, x+24*scale-1, y, w-48*scale+2, 24*scale, 24,0,80,24);
    p5.image(buttonImage, x+24*scale-1, y+h-24*scale, w-48*scale+2, 24*scale, 24,104,80,24);
    p5.image(buttonImage, x, y+24*scale-1, 24*scale, h-48*scale+2, 0,24,24,80);
    p5.image(buttonImage, x+w-24*scale, y+24*scale-1, 24*scale, h-48*scale+2, 104,24,24,80);

    //corners
    p5.image(buttonImage, x,y,24*scale,24*scale,0,0,24,24);
    p5.image(buttonImage, x+w-24*scale,y,24*scale,24*scale,104,0,24,24);
    p5.image(buttonImage, x,y+h-24*scale,24*scale,24*scale,0,104,24,24);
    p5.image(buttonImage, x+w-24*scale,y+h-24*scale,24*scale,24*scale,104,104,24,24);

    p5.fill(255);
    p5.textSize(scale*50);
    p5.textAlign(p5.CENTER,p5.CENTER);
    p5.text(text,x+w/2,y+h/2);

    if(isIn && mouseData.wasDown && !mouseData.down && buttonData[buttonId]){
        onClick();
        buttonData[buttonId]=false;
    }
    if(isIn && !mouseData.wasDown && mouseData.down) buttonData[buttonId]=true;
    if(!isIn) buttonData[buttonId]=false;
}
