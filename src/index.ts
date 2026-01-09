import {AmbientLight, Color, Mesh, MeshBasicMaterial, Scene, WebGLRenderer} from "three";
import {camera, modelLoader, textureLoader} from "./client/clientConsts.js";
import VisualGame, {ViewType} from "./client/VisualGame.js";
import {frontendInit} from "./networking/LocalServer.js";
import {FindGameEvent, RequestSyncEvent} from "./networking/Events.js";
import cards, {specialCards} from "./Cards.js";
import type CardData from "./CardData.js";
import {network} from "./networking/Server.js";
import {registerDrawCallback} from "./client/ui.js";

/////
// version 0.1.0
/////

// Init scene.
const scene = new Scene();
scene.background = new Color("#111111");
scene.add(new AmbientLight(new Color(0xffffff), 3));
scene.add(camera);

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
setTimeout(()=>{
    game.sendEvent(new FindGameEvent({
        deck:(()=>{
            const toReturn = [
                "og-014"
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
    }, undefined))
},1000)

let lastTick = [Date.now(), Date.now()];
let avgFps:number[] = [];
registerDrawCallback(0,(p5, scale)=>{
    p5.push();
    p5.fill(255,0,0);
    p5.rect(p5.width, p5.height, -Math.round(avgFps.reduce((a,c)=>a+c,0)/avgFps.length),-10)
    p5.textSize(scale*0.1);
    p5.textAlign(p5.RIGHT,p5.BOTTOM);
    p5.text(Math.round(avgFps.reduce((a,c)=>a+c,0)/avgFps.length), p5.width-10,p5.height-10);

    avgFps.unshift(1000/(lastTick[0]!-lastTick[1]!));
    avgFps = avgFps.slice(0,20);
})
renderer.setAnimationLoop(() => {
    if(lastTick[0]!-lastTick[1]!<16){
        lastTick[0] = Date.now();
        return;
    }
    game.tick();
    game.visualTick();
    renderer.render(scene, camera);
    lastTick.pop();
    lastTick.unshift(Date.now());
});

frontendInit();

setInterval(()=>{
    network.sendToServer(new RequestSyncEvent({}));
},1000);

// @ts-ignore
window.logGame = ()=> console.log(game)
