import {
    Scene,
    Color,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    WebGLRenderer,
    BoxGeometry
} from "three";

// Init scene.
const scene = new Scene();
scene.background = new Color("#191919");

// Init camera.
let aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(50, aspect, 1, 1000);
camera.position.z = 700;

// Init renderer.
const renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(() => renderer.render(scene, camera));
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add test mesh.

const geometry = new BoxGeometry(200, 200, 200);
const material = new MeshNormalMaterial();
const mesh = new Mesh(geometry, material);
scene.add(mesh);
renderer.render(scene, camera);

/*
this.cube.rotation.x += 0.005;
        this.cube.rotation.y += 0.001;

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
 */
