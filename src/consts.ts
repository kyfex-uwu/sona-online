import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {PerspectiveCamera, TextureLoader} from "three";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();

// Init camera.
let aspect = window.innerWidth / window.innerHeight;
export const camera = new PerspectiveCamera(50, aspect, 1, 10000);
camera.position.z = 220;
camera.position.y = 600;
camera.rotation.x = -Math.PI*0.4;

export const updateOrder: {[k:string]:number}={};
