import Card from "./Card.js";
import type {GameElement} from "./GameElement.js";
import {Mesh, PlaneGeometry, Raycaster, type Scene, Vector2, Vector3} from "three";
import {camera, updateOrder} from "./consts.js";

const raycaster = new Raycaster();
const pointer = new Vector2();

window.addEventListener("pointermove", ( event: { clientX: number; clientY: number; } )=> {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
})
const geo = new Mesh(new PlaneGeometry(999999,999999).rotateX(-Math.PI/2));

export default class Game{

    public selectedCard:Card|undefined;
    private readonly elements:GameElement[] = [];
    private readonly scene:Scene;
    public cursorPos:Vector3 = new Vector3();

    public constructor(scene:Scene) {
        this.scene=scene;
    }

    public addElement(element:GameElement){
        element.addToScene(this.scene, this);
        this.elements.push(element);

        this.elements.sort((e1,e2) => {
            return (updateOrder[e2.constructor.name]||999999) - (updateOrder[e1.constructor.name]||999999);
        });
    }

    public tick(){
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects([geo]);
        if (intersects[0] !== undefined) {
            this.cursorPos = intersects[0].point;
        }

        for(const element of this.elements) element.tick(this);
    }
    public visualTick(){
        for(const element of this.elements) element.visualTick(this);
    }
}
