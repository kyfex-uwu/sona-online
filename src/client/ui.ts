import p5 from "p5";
import {clickListener} from "./clientConsts.js";

const drawCallbacks:{[k:number]:Array<(p5:any, scale:number)=>void>} = {};

/**
 * Registers a drawing callback to be called at the specified z index
 * @param layer The specific z index to call this callback at. Lower layers get draws under (called before) higher layers
 * @param callback The function to call
 */
export function registerDrawCallback(layer:number, callback:(p5:any, scale:number)=>void){
    drawCallbacks[layer]=drawCallbacks[layer]||[];
    drawCallbacks[layer].push(callback);
    return ()=>{
        const index = (drawCallbacks[layer]||[]).indexOf(callback);
        if(index!==-1) drawCallbacks[layer]!.splice(index,1);
    }
}

export const assets:{[k:string]:p5.Image} = {};

//top 10 worst code snippets ever
const oldLog = console.log;
console.log = function(...args){
    if(typeof args[0] === "string" && (
        args[0].startsWith("🌸 p5.js says:") ||
        args[0].startsWith("Zod error object"))) return;
    oldLog(...args);
}
export function tempHowToUse(name:string, message:string){
    console.log(`%cHow to use ${name}:\n${message}`, `background:#134142; color:#00ff91`);
}

const mouseData = {
    down:false,
    wasDown:false,
};
let p5Inst;
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
        p.loadImage(`/assets/button_disabled.png`, (image:p5.Image) => {
            assets["button_disabled"] = image;
        });

        p.loadImage(`/assets/stat_red.png`, (image:p5.Image) => assets.statRed = image);
        p.loadImage(`/assets/stat_blue.png`, (image:p5.Image) => assets.statBlue = image);
        p.loadImage(`/assets/stat_yellow.png`, (image:p5.Image) => assets.statYellow = image);
        p.loadImage(`/assets/stat_red_s.png`, (image:p5.Image) => assets.statRedS = image);
        p.loadImage(`/assets/stat_blue_s.png`, (image:p5.Image) => assets.statBlueS = image);
        p.loadImage(`/assets/stat_yellow_s.png`, (image:p5.Image) => assets.statYellowS = image);

        p.loadImage(`/assets/info.png`, (image:p5.Image) => assets.info = image);
    };
    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    }

    p.draw = () => {
        p.clear();
        mouseData.wasDown=mouseData.down;
        mouseData.down=p.mouseIsPressed;

        buttons.length=0;
        const scale = Math.min(p.windowWidth/4,p.windowHeight/3);
        for(const callbackList of Object.entries(drawCallbacks)
            .toSorted((e1, e2)=>parseFloat(e1[0])-parseFloat(e2[0]))){
            for(const callback of callbackList[1]) callback(p, scale);
        }
    };
    p5Inst=p;
}, document.getElementById("uiLayer")!);
clickListener(()=>{
    for(const b of buttons){
        if(buttonData[b.id] && p5Inst!.mouseX>=b.x&&p5Inst!.mouseX<=b.x+b.w&&p5Inst!.mouseY>=b.y&&p5Inst!.mouseY<=b.y+b.h){
            b.onClick();
            buttonData[b.id]=false;
            return true;
        }
    }
    return false;
})

let _buttonId=0;
//This function returns a valid, unique button id to be used in {@link button}
export function buttonId(){ return _buttonId++; }
const buttonData:{[k:number]:boolean}={};

const buttons:{x:number,y:number,w:number,h:number,id:number,onClick:()=>void}[]=[];
/**
 * Draws and handles a button
 * @param p5 the p5 instance
 * @param x
 * @param y
 * @param w width
 * @param h height
 * @param text text to display
 * @param onClick function to run on click
 * @param scale How zoomed in the button should appear. This does not affect the size or position,
 * it just makes the edges of the button bigger (bigger scale) or smaller (smaller scale)
 * @param buttonId The id of the button. This should be fetched through {@link buttonId} and stored somewhere; this button should only use this buttonId
 * @param disabled If this button is disabled. This grays it out and prevents it from being clicked
 */
export function button(p5:any, x:number,y:number,w:number,h:number,text:string,onClick:()=>void, scale:number, buttonId:number, disabled:boolean=false){
    if(assets.button === undefined || assets.button_pressed === undefined || assets.button_disabled === undefined) return;

    scale=scale/128/2.5;

    invisibleButton(p5, x, y, w, h, onClick, buttonId, (isIn)=>{
        const buttonImage = disabled ? assets.button_disabled : (isIn ?
            assets.button_pressed : assets.button);

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

        p5.fill(!disabled?255:200);
        p5.textSize(scale*50);
        p5.textAlign(p5.CENTER,p5.CENTER);
        const textWidth = p5.textWidth(text);
        if(textWidth>w-52*scale)
            p5.textSize(scale*50*(w-52*scale)/textWidth);
        p5.text(text,x+w/2,y+h/2);
    },disabled);
}

export function invisibleButton(p5:any, x:number, y:number, w:number, h:number, onClick:()=>void, buttonId:number,
                                render:(isIn:boolean)=>void, disabled:boolean=false){
    if(buttonData[buttonId] === undefined)
        buttonData[buttonId]=false;

    const isIn=p5.mouseX>=x&&p5.mouseX<=x+w&&p5.mouseY>=y&&p5.mouseY<=y+h;

    render(isIn);

    if(!disabled){
        buttons.push({
            x,y,w,h,onClick,id:buttonId,
        });
    }
    if(isIn && !mouseData.wasDown && mouseData.down) buttonData[buttonId]=true;
    if(!isIn) buttonData[buttonId]=false;
}

export function textHeight(p5:any, text:string, maxWidth:number) {
    const words = text.split(' ');
    let line = '';
    let h = p5.textLeading();

    for (let i = 0; i < words.length; i++) {
        let testLine = line + words[i] + ' ';
        let testWidth = p5.textWidth(testLine);

        if (testWidth > maxWidth && i > 0) {
            line = words[i] + ' ';
            h += p5.textLeading();
        } else {
            line = testLine;
        }
    }

    return h;
}

export function textBox(p5:any, scale:any, text:string){
    const padding = p5.width*0.005;

    p5.push();
    p5.fill(0,0,0,200);
    p5.noStroke();
    p5.textSize(scale*0.15);
    p5.rect(p5.width/6, scale/2, p5.width*2/3, textHeight(p5, text, p5.width*2/3-padding*2)+padding);
    p5.fill(255, 255, 255);
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.text(text, p5.width/6+padding, scale/2+padding, p5.width*2/3-padding*2);
    p5.pop();
}