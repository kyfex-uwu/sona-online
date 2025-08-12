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
    clickedListeners.push(listener);
}

export const updateOrder: {[k:string]:number}={};
