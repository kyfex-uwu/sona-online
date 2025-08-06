import {modelLoader, textureLoader, updateOrder} from "./consts.js";
import {Group, Mesh, MeshBasicMaterial, Object3D, Quaternion, type Scene, Vector3} from "three";
import {type GameElement, Side} from "./GameElement.js";
import Game from "./Game.js";

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

export type CardTemplate = (position:Vector3, side:Side, rotation?:Quaternion)=>Card;

export default class Card implements GameElement{
    public readonly imagePath: string;
    public position: Vector3;
    private realPosition: Vector3;
    public rotation: Quaternion;
    private realRotation: Quaternion;
    private _model?: Group;
    get model(): Group|undefined {
        return this._model;
    }
    private readonly side:Side;

    constructor(imagePath: string, position: Vector3, rotation: Quaternion = new Quaternion(), side:Side) {
        this.imagePath=imagePath;
        this.position = position.clone();
        this.realPosition = position.clone();
        this.rotation = rotation.clone();
        this.realRotation = rotation.clone();
        this.side=side;
    }
    public static template(imagePath:string):CardTemplate{
        return (position:Vector3, side:Side, rotation?: Quaternion) => {
            return new Card(imagePath, position, rotation || new Quaternion(), side);
        }
    }

    async createModel(){
        if(this._model !== undefined) return;

        let obj = (await cardModel).clone();
        (obj.children[0] as Mesh).material = new MeshBasicMaterial({
            map: textureLoader.load( `/assets/card-images/${this.imagePath}.jpg`),
            alphaMap: cardShape,
            transparent:true,
        });
        (obj.children[1] as Mesh).material = cardBackMat;

        const model = new Group();
        model.add(obj);
        model.userData.card=this;
        this._model = model;
    }

    tick(parent: Game) {
        if(parent.selectedCard === this) {
            this.position = parent.cursorPos.clone();
            //this.rotation = new Euler();
        }
    }
    visualTick(parent: Game) {
        const targetPos = this.position.clone();
        const targetRot = this.rotation.clone();

        if(parent.selectedCard === this){
            targetPos.y =
                Math.max.apply(null,parent.elements
                    .filter(e=>e instanceof Card)
                    .filter(card => card.position.distanceTo(this.position)<70)
                    .map(card => card.position.y))+10;
        }
        // if(parent.cursorPos.distanceTo(this.position)<50 && this.faceUp &&
        //     (parent.selectedCard === this || parent.selectedCard === undefined)){
        //     targetPos.lerp(camera.position, 0.5);
        //     // targetRot.slerp(camera.quaternion, 0.5);
        // }

        this.realPosition.lerp(targetPos,0.2);
        this.realRotation.slerp(targetRot, 0.1);
        if(this._model !== undefined){
            this._model.position.copy(this.realPosition);
            this._model.quaternion.copy(this.realRotation);
            (this._model.children[0] as Object3D).quaternion.slerp(this.flipRotation,0.1);
            (this._model.children[0] as Object3D).position.lerp(new Vector3(0,5*this.flipTimer,0),0.1);
            this.flipTimer=Math.max(0,this.flipTimer-1);
        }
    }
    setRealPosition(pos:Vector3){
        this.realPosition=pos;
    }
    setRealRotation(rot:Quaternion){
        this.realRotation=rot;
    }

    addToScene(scene: Scene, game:Game) {
        this.createModel().then(()=>{
            scene.add(this.model!);
        });
    }

    private flipRotation:Quaternion = new Quaternion();
    private flipTimer=0;
    private faceUp = true;
    flipFacedown(){
        this.flipRotation = new Quaternion(0,0,1,0);
        this.flipTimer = 20;
        this.faceUp=false;
    }
    flipFaceup(){
        this.flipRotation = new Quaternion(0,0,0,1);
        this.flipTimer = 20;
        this.faceUp=true;
    }
    getSide(){ return this.side; }
    getFaceUp(){ return this.faceUp; }
}
updateOrder[Card.name] = 0;
