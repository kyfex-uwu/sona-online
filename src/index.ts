import {
    Scene,
    Color,
    WebGLRenderer,
    Vector3
} from "three";
import Game from "./Game.js";
import {camera} from "./consts.js";
import FieldMagnet from "./magnets/FieldMagnet.js";
import RunawayMagnet from "./magnets/RunawayMagnet.js";

// Init scene.
const scene = new Scene();
scene.background = new Color("#ff0000");

// Init renderer.
const renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true,
    premultipliedAlpha: false,
    alpha: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//--

const game = new Game(scene);
game.addElement(new FieldMagnet(new Vector3(100,0,200)));
game.addElement(new FieldMagnet(new Vector3(0,0,200)));
game.addElement(new FieldMagnet(new Vector3(-100,0,200)));
game.addElement(new RunawayMagnet(new Vector3(-200,0,200)));

renderer.setAnimationLoop(() => {
    game.tick();
    game.visualTick();
    renderer.render(scene, camera)
});
