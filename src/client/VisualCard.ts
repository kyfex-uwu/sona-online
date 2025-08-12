import {Group, type Mesh, MeshBasicMaterial, type Object3D, Quaternion, type Scene, Vector3} from "three";
import {modelLoader, textureLoader} from "./clientConsts.js";
import Card from "../Card.js";
import type {Side} from "../GameElement.js";
import type VisualGame from "./VisualGame.js";
import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";

const cardModel = (() => {
    let resolve : (v:any) => void;
    let promise = new Promise<Mesh>(r=>resolve=r);

    modelLoader.load("/assets/card.glb", model => {
        const toReturn = new Group();
        toReturn.add((model.scene.children[0] as Object3D).clone());
        const other = (model.scene.children[0] as Object3D).clone();
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
    map: textureLoader.load( "/assets/card-images/card_back.jpg"),
    alphaMap: cardShape,
    transparent:true,
});

export type VisualCardTemplate = (side:Side, position:Vector3, rotation?:Quaternion)=>VisualCard;

export default class VisualCard extends PositionedVisualGameElement{
    public readonly card:Card;
    private _model?: Group;
    get model(): Group|undefined {
        return this._model;
    }

    constructor(card: Card, side:Side, position: Vector3, rotation: Quaternion = new Quaternion()) {
        super(side, position, rotation);
        this.card=card;
    }

    async createModel(){
        if(this._model !== undefined) return;

        let obj = (await cardModel).clone();
        (obj.children[0] as Mesh).material = new MeshBasicMaterial({
            map: textureLoader.load( `/assets/card-images/${this.card.cardData.imagePath}.jpg`),
            alphaMap: cardShape,
            transparent:true,
        });
        (obj.children[1] as Mesh).material = cardBackMat;

        const model = new Group();
        model.add(obj);
        model.userData.card=this;
        this._model = model;
    }

    visualTick(parent: VisualGame) {
        const targetPos = this.position.clone();
        const targetRot = this.rotation.clone();
        if(parent.selectedCard === this){
            targetPos.y =
                Math.max.apply(null,parent.elements
                    .filter(e=>e instanceof VisualCard)
                    .filter(card => card.position.distanceTo(this.position)<70)
                    .map(card => card.position.y))+10;

        }
        // if(parent.cursorPos.distanceTo(this.position)<50 && this.faceUp &&
        //     (parent.selectedCard === this || parent.selectedCard === undefined)){
        //     targetPos.lerp(camera.position, 0.5);
        //     // targetRot.slerp(camera.quaternion, 0.5);
        // }
        super.visualTick(parent, targetPos, targetRot);

        if(this._model !== undefined){
            this._model.position.copy(this.realPosition);
            this._model.quaternion.copy(this.realRotation);
            (this._model.children[0] as Object3D).quaternion.slerp(this.flipRotation,0.1);
            (this._model.children[0] as Object3D).position.lerp(new Vector3(0,5*this.flipTimer,0),0.1);
            this.flipTimer=Math.max(0,this.flipTimer-1);
        }
    }

    addToScene(scene: Scene, game:VisualGame) {
        this.createModel().then(()=>{
            scene.add(this.model!);
        });
    }

    private flipRotation:Quaternion = new Quaternion();
    private flipTimer=0;
    flipFacedown(){
        this.flipRotation = new Quaternion(0,0,1,0);
        this.flipTimer = 20;
    }
    flipFaceup(){
        this.flipRotation = new Quaternion(0,0,0,1);
        this.flipTimer = 20;
    }
}
