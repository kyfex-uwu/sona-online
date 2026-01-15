import {
    AmbientLight,
    Color,
    CubeTextureLoader,
    Scene,
    WebGLRenderer
} from "three";
import {camera, modelLoader} from "./client/clientConsts.js";
import VisualGame, {ViewType} from "./client/VisualGame.js";
import {frontendInit} from "./networking/LocalServer.js";
import {FindGameEvent, RequestSyncEvent} from "./networking/Events.js";
import cards, {specialCards} from "./Cards.js";
import type CardData from "./CardData.js";
import {network} from "./networking/Server.js";

import Stats from "stats.js";

/////
// version 0.1.0
/////

const stats = new Stats();
stats.showPanel(0);
document.getElementById("stats")!.appendChild(stats.dom);

// Init scene
const scene = new Scene();

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
const renderer = new WebGLRenderer({
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

export const game = new VisualGame(scene);
game.changeView(ViewType.WHOLE_BOARD_A);
game.sendEvent(new FindGameEvent({
    deck:(()=>{
        const toReturn = [
            "og-031"
        ];
        const alreadyAdded:{[k:string]:true} = {};
        for(const card of toReturn) alreadyAdded[card]=true;
        const cardsValues = Object.values(cards);
        let oneFlag = false;
        for(let i=0;i<20;i++) {
            if(toReturn[i] !== undefined) continue;

            let toAdd:CardData;
            do {
                toAdd = cardsValues[Math.floor(Math.random() * cardsValues.length)]!;
            }while(specialCards.has(toAdd.name) || (alreadyAdded[toAdd.name] && (i!==19 || oneFlag || toAdd.level !== 1)));

            toReturn[i]=toAdd.name;
            alreadyAdded[toAdd.name]=true;
            oneFlag = oneFlag || toAdd.level === 1;
        }
        return toReturn;
    })(),
}, undefined));

renderer.setAnimationLoop(() => {
    stats.begin();
    game.tick();
    game.visualTick();
    renderer.render(scene, camera);
    stats.end();
});

frontendInit();

setInterval(()=>{
    network.sendToServer(new RequestSyncEvent({}));
},1000);

// @ts-ignore
window.logGame = ()=> console.log(game)
