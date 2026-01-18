import {camera, renderer, scene} from "./client/clientConsts.js";
import Stats from "stats.js";
import {GameScene} from "./client/scenes/GameScene.js";
import type {Scene} from "./client/scenes/Scene.js";

/////
// version 0.1.0
/////

const stats = new Stats();
stats.showPanel(0);
document.getElementById("stats")!.appendChild(stats.dom);

let currScene:Scene = new GameScene();
export function setScene(scene:()=>Scene){
    currScene.exit();
    currScene=scene();
}

renderer.setAnimationLoop(() => {
    stats.begin();
    currScene.tick();
    renderer.render(scene, camera);
    stats.end();
});
