import {modelLoader, textureLoader} from "./consts.js";
import {
    Group,
    LinearFilter,
    LinearMipmapLinearFilter,
    LinearMipmapNearestFilter,
    Material,
    Mesh,
    MeshBasicMaterial, Vector3
} from "three";

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
    }, undefined, err => {
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

export default class Card{
    public readonly imagePath: string;
    public position: Vector3;
    private realPosition: Vector3;
    public rotation: Vector3;
    private _model?: Mesh;
    get model(): Mesh|undefined {
        return this._model;
    }

    constructor(imagePath: string, position: Vector3, rotation: Vector3 = new Vector3()) {
        this.imagePath=imagePath;
        this.position = position;
        this.realPosition = position;
        this.rotation = rotation;
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

    updateModel(){
        this.realPosition.lerp(this.position,0.2);
        if(this._model !== undefined){
            this._model.position.copy(this.realPosition);
        }
    }
}
