import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PerspectiveCamera, TextureLoader} from "three";
import {Side} from "./GameElement.js";
import {CurrentTurn} from "./Game.js";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();

// Init camera.
let aspect = window.innerWidth / window.innerHeight;
export const camera = new PerspectiveCamera(50, aspect, 1, 10000);

export const updateOrder: {[k:string]:number}={};

export function shuffled<T>(array:Array<T>):Array<T>{
    let shuffledMarker = array.length;

    while (shuffledMarker>1) {
        const nextIndex = Math.floor(Math.random() * shuffledMarker);
        shuffledMarker--;
        // @ts-ignore
        [array[shuffledMarker], array[nextIndex]] = [array[nextIndex], array[shuffledMarker]];
    }

    return array;
}

let clickedListeners:Array<()=>boolean>=[];
window.addEventListener("mouseup", ()=>{
    for(const listener of clickedListeners) if(listener()) break;
});
export function clickListener(listener:()=>boolean){
    clickedListeners.push(listener);
}

export function sidesMatch(side1:Side, side2:CurrentTurn){
    return (side1 === Side.YOU && side2 == CurrentTurn.YOURS) ||
        (side1 == Side.THEM && side2 == CurrentTurn.THEIRS);
}
