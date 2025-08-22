import {Color, Mesh, MeshBasicMaterial, Scene, WebGLRenderer} from "three";
import {camera, modelLoader, textureLoader} from "./client/clientConsts.js";
import VisualGame, {ViewType} from "./client/VisualGame.js";
import {frontendInit} from "./networking/LocalServer.js";
import {FindGameEvent} from "./networking/Events.js";
import cards from "./Cards.js";
import {shuffled} from "./consts.js";

// Init scene.
const scene = new Scene();
scene.background = new Color("#111111");

modelLoader.load("/assets/board.glb", model => {
    (model.scene.children[0] as Mesh).material = new MeshBasicMaterial({
        map: textureLoader.load("/assets/temp_board_tex.png")
    })
    scene.add(model.scene);
});

// Init renderer.
const renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true,
    premultipliedAlpha: false,
    alpha: true,
});
function windowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = 50
    if(camera.aspect < 4/3) camera.fov = 180-(1-(1-(camera.aspect*3/4))**1.8)*130//todo: not done :c
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
renderer.setPixelRatio(window.devicePixelRatio);
windowResize();
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", windowResize);

//--

frontendInit();

export const game = new VisualGame(scene);
game.changeView(ViewType.WHOLE_BOARD_YOU);
setTimeout(()=>{
    game.sendEvent(new FindGameEvent({
        deck:(()=>{
            const toReturn = [];
            for(let i=0;i<20;i++) {
                toReturn.push(shuffled(Object.entries(cards).filter(e => e[1].level == 1 && e[0] !== "unknown"))[0]![0]);
            }
            return toReturn;
        })(),
    }, undefined))
},1000)

renderer.setAnimationLoop(() => {
    game.tick();
    game.visualTick();
    renderer.render(scene, camera)
});
