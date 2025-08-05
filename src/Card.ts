import {modelLoader, textureLoader, updateOrder} from "./consts.js";
import {
    Group,
    LinearFilter,
    Mesh,
    MeshBasicMaterial, Quaternion, type Scene, Vector3
} from "three";
import type {GameElement} from "./GameElement.js";
import  Game from "./Game.js";

const cardModel = (() => {
    let resolve : (v:any) => void;
    let promise = new Promise<Mesh>(r=>resolve=r);

    modelLoader.load("/assets/card.glb", model => {
        const toReturn = new Group();
        toReturn.add((model.scene.children[0] as Mesh).clone());
        const other = (model.scene.children[0] as Mesh).clone();
        other.rotateX(Math.PI);
        toReturn.add(other);
        resolve(toReturn);
    }, undefined, () => {
        resolve(undefined);
    });

    return promise;
})();
const cardShape = textureLoader.load("/assets/card-images/card_shape.png");
const cardBackMat = new MeshBasicMaterial({
    map: textureLoader.load( "/assets/card-images/card-back.jpg"),
    alphaMap: cardShape,
    transparent:true,
});

export default class Card implements GameElement{
    public readonly imagePath: string;
    public position: Vector3;
    private realPosition: Vector3;
    public rotation: Quaternion;
    private realRotation: Quaternion;
    private _model?: Mesh;
    get model(): Mesh|undefined {
        return this._model;
    }

    constructor(imagePath: string, position: Vector3, rotation: Quaternion = new Quaternion()) {
        this.imagePath=imagePath;
        this.position = position;
        this.realPosition = position;
        this.rotation = rotation;
        this.realRotation = rotation;
    }

    async createModel(){
        if(this._model !== undefined) return;

        let obj = (await cardModel).clone();
        (obj.children[0] as Mesh).material = new MeshBasicMaterial({
            map: textureLoader.load( `/assets/card-images/${this.imagePath}.jpg`, tex => {
                tex.minFilter = LinearFilter;
            }),
            alphaMap: cardShape,
            transparent:true,
        });
        (obj.children[1] as Mesh).material = cardBackMat;
        this._model = obj;
    }

    tick(parent: Game) {
        if(parent.selectedCard === this) {
            this.position = parent.cursorPos;
            this.rotation = new Quaternion();
        }
    }
    visualTick(parent: Game) {
        this.realPosition.lerp(this.position,0.2);
        this.realRotation.slerp(this.rotation, 0.2);
        if(this._model !== undefined){
            this._model.position.copy(this.realPosition);
            this._model.quaternion.copy(this.realRotation);
        }
    }

    addToScene(scene: Scene, game:Game) {
        this.createModel().then(()=>{
            scene.add(this.model!);
        });
    }
}
updateOrder[Card.name] = 0;
