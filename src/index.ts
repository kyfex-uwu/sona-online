import {
    Scene,
    Color,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    WebGLRenderer,
    BoxGeometry, Vector3, Raycaster, Vector2, PlaneGeometry, MeshStandardMaterial
} from "three";
import Card from "./Card.js";
import CardMagnet from "./CardMagnet.js";

// Init scene.
const scene = new Scene();
scene.background = new Color("#ff0000");

// Init camera.
let aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(50, aspect, 1, 10000);
camera.position.z = 700;
camera.position.y = 400;
camera.rotation.x = -Math.PI*0.2;

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

const card = new Card("1754325492309-b5bbee0a-1bc2-4bb3-b1fe-f79be3d07b3c_", new Vector3());
await card.createModel();
scene.add(card.model!);

const geo = new Mesh(new PlaneGeometry(999999,999999).rotateX(-Math.PI/2), new MeshStandardMaterial({
    color:"#ffffff"
}));
scene.add(geo);

const cardMagnet = new CardMagnet(new Vector3(0,10,0));

//--

const raycaster = new Raycaster();
const pointer = new Vector2();

window.addEventListener("pointermove", ( event: { clientX: number; clientY: number; } )=> {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
})

renderer.setAnimationLoop(() => {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects( [geo] );
    if(intersects[0] !== undefined){
        card.position = intersects[0].point.add(new Vector3(0,10,0));
    }

    cardMagnet.applyCardOffset(card);

    card.updateModel();
    renderer.render(scene, camera)
});
