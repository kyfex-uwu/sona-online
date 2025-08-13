import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PerspectiveCamera, TextureLoader} from "three";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();

// Init camera.
let aspect = window.innerWidth / window.innerHeight;
export const camera = new PerspectiveCamera(50, aspect, 1, 10000);

let clickedListeners:Array<()=>boolean>=[];
window.addEventListener("mouseup", ()=>{
    for(const listener of clickedListeners) if(listener()) break;
});
export function clickListener(listener:()=>boolean){
    return clickedListeners.push(listener)-1;
}
export function removeClickListener(index:number){
    clickedListeners.splice(index,1);
}

export const updateOrder: {[k:string]:number}={};

export async function wait(ms:number){
    let resolve:(v:any)=>void=()=>{};
    const p = new Promise(r=>resolve=r);
    setTimeout(resolve, ms);
}
