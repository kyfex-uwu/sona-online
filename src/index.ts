import {Color, Mesh, MeshBasicMaterial, Scene, WebGLRenderer} from "three";
import Game, {ViewType} from "./Game.js";
import {camera, modelLoader, textureLoader} from "./consts.js";
import cards from "./Cards.js";

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
    if(camera.aspect < 4/3) camera.fov = 180-(1-(1-(camera.aspect*3/4))**1.8)*130
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
renderer.setPixelRatio(window.devicePixelRatio);
windowResize();
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", windowResize);

//--

const game = new Game(scene);
game.changeView(ViewType.WHOLE_BOARD);
game.startGame([
    ...(()=>{
        const options = Object.keys(cards);
        const toReturn=[];
        for(let i=0;i<20;i++){
            toReturn.push(cards[options.splice(Math.floor(Math.random()*options.length),1)[0]!]!)
        }
        return toReturn;
    })()
],[
    ...(()=>{
        const options = Object.keys(cards);
        const toReturn=[];
        for(let i=0;i<20;i++){
            toReturn.push(cards[options.splice(Math.floor(Math.random()*options.length),1)[0]!]!)
        }
        return toReturn;
    })()
]);

renderer.setAnimationLoop(() => {
    game.tick();
    game.visualTick();
    renderer.render(scene, camera)
});
