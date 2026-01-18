import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AmbientLight, Color, CubeTextureLoader, PerspectiveCamera, Scene, TextureLoader, WebGLRenderer} from "three";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();

// Init camera
let aspect = window.innerWidth / window.innerHeight;
export const camera = new PerspectiveCamera(50, aspect, 1, 10000);

export const scene = new Scene();

const loader = new CubeTextureLoader();
loader.setPath('/assets/skybox/cloudy/');
scene.background = loader.load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

scene.add(new AmbientLight(new Color(0xffffff), 3));
scene.add(camera);

modelLoader.load("/assets/board.glb", model => {
    model.scene.scale.set(10,10,10);
    scene.add(model.scene);
});

// Init renderer.
export const renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true,
    premultipliedAlpha: false,
    alpha: true,
});
//Resizes the canvas to the window bounds
function windowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;

    //taken from https://discourse.threejs.org/t/keeping-an-object-scaled-based-on-the-bounds-of-the-canvas-really-battling-to-explain-this-one/17574/10
    //i was ripping my HAIR out
    const fov = 50;
    const planeAspectRatio = 4/3;
    if (camera.aspect > planeAspectRatio) {
        camera.fov = fov;
    } else {
        const cameraHeight = Math.tan((fov / 2)/360*2*Math.PI);
        const ratio = camera.aspect / planeAspectRatio;
        const newCameraHeight = cameraHeight / ratio;
        camera.fov = (Math.atan(newCameraHeight))/2/Math.PI*360  * 2;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
renderer.setPixelRatio(window.devicePixelRatio);
windowResize();
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", windowResize);

//--

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
