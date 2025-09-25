import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PerspectiveCamera, TextureLoader} from "three";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();

// Init camera
let aspect = window.innerWidth / window.innerHeight;
export const camera = new PerspectiveCamera(50, aspect, 1, 10000);

let clickedListeners:Array<()=>boolean>=[];
window.addEventListener("mouseup", ()=>{
    for(const listener of clickedListeners) if(listener()) break;
});

//@param listener The function that will run every time the mouse is clicked
//@return The id of this listener
export function clickListener(listener:()=>boolean){
    return clickedListeners.push(listener)-1;
}
//@param index The id of the listener to remove. Should be whatever {@link clickListener} returned
export function removeClickListener(index:number){
    clickedListeners.splice(index,1);
}

export const updateOrder: {[k:string]:number}={};

//@param ms The amount of milliseconds to wait
export async function wait(ms:number){
    let resolve:(v:any)=>void=()=>{};
    const p = new Promise(r=>resolve=r);
    setTimeout(resolve, ms);
    await p;
}

