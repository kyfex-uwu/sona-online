import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {TextureLoader} from "three";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();
