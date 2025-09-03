import {
    Color,
    Euler,
    Group,
    Material,
    type Mesh,
    MeshBasicMaterial,
    type Object3D,
    Quaternion,
    type Scene, Texture,
    Vector3
} from "three";
import {modelLoader, textureLoader, updateOrder} from "./clientConsts.js";
import Card from "../Card.js";
import type {Side} from "../GameElement.js";
import VisualGame from "./VisualGame.js";
import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import {game} from "../index.js";
import {sideTernary} from "../consts.js";

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
    private _card:Card;
    public get card(){
        return this._card;
    }
    public readonly model: Group = new Group();
    private readonly flipGroup: Group = new Group();
    private enabledMaterial:Material|undefined;
    private disabledMaterial:Material|undefined;

    constructor(card: Card, position: Vector3, rotation: Quaternion = new Quaternion()) {
        super(card.getSide(), position, rotation);
        this.enabled=true;

        this.model.add(this.flipGroup);
        this._card=card;
        this.populate(card);
    }
    populate(card:Card){
        this._card=card;
        this.flipGroup.clear();
        this.model.userData.card=this;
        this.enabledMaterial?.dispose();
        this.disabledMaterial?.dispose();
        this.createModel();
    }
    async repopulate(card:Card){
        this._card=card;

        let texture:Texture|undefined;

        await Promise.all([this.createModel(),
        textureLoader.loadAsync(`/assets/card-images/${card.cardData.imagePath}.jpg`).then(t=>{
            texture=t;
        })]);

        //if(this.flipGroup.children[0] !== actualModel) return;

        this.enabledMaterial= new MeshBasicMaterial({
            map: texture!,
            alphaMap: cardShape,
            transparent:true,
        });
        this.disabledMaterial = new MeshBasicMaterial({
            map: texture!,
            alphaMap: cardShape,
            transparent:true,
            color:new Color(0x777777),
        });
        (this.flipGroup.children[0]!.children[0] as Mesh).material = this.enabled?this.enabledMaterial:this.disabledMaterial;
    }

    private loadingModel=false;
    async createModel(){
        if(this.flipGroup.children.length>0||this.loadingModel) return;
        this.loadingModel=true;
        let actualModel = (await cardModel).clone();
        this.flipGroup.add(actualModel);

        this.enabledMaterial = new MeshBasicMaterial({
            alphaMap: cardShape,
            transparent:true,
        });
        this.disabledMaterial = new MeshBasicMaterial({
            alphaMap: cardShape,
            transparent:true,
            color:new Color(0x777777),
        });
        (actualModel.children[0] as Mesh).material = this.enabled?this.enabledMaterial:this.disabledMaterial;
        (actualModel.children[1] as Mesh).material = cardBackMat;

        textureLoader.loadAsync(`/assets/card-images/${this.card.cardData.imagePath}.jpg`).then((texture)=>{
            if(this.flipGroup.children[0] !== actualModel) return;

            this.enabledMaterial= new MeshBasicMaterial({
                map: texture,
                alphaMap: cardShape,
                transparent:true,
            });
            this.disabledMaterial = new MeshBasicMaterial({
                map: texture,
                alphaMap: cardShape,
                transparent:true,
                color:new Color(0x777777),
            });
            (actualModel.children[0] as Mesh).material = this.enabled?this.enabledMaterial:this.disabledMaterial;
            this.loadingModel=false;
        });
    }

    tick(parent: VisualGame) {
        super.tick(parent);
        if(parent.selectedCard === this) {
            this.position = parent.cursorPos;
            this.rotation = sideTernary(game.getGame().side, new Quaternion(), new Quaternion().setFromEuler(new Euler(0,Math.PI,0)));
        }

        // if(!this.enabled){
        //     (this.model?.children[0]!.children[0] as Mesh).material = this.disabledMaterial!;
        // }else{
        //     (this.model?.children[0]!.children[0] as Mesh).material = this.enabledMaterial!;
        // }
    }

    visualTick(parent: VisualGame) {
        let targetPos = this.position.clone();
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

        this.model.position.copy(this.realPosition);
        this.model.quaternion.copy(this.realRotation);
        this.flipGroup.quaternion.slerp(this.flipRotation,0.1);
        this.flipGroup.position.lerp(new Vector3(0,5*this.flipTimer,0),0.1);
        this.flipTimer=Math.max(0,this.flipTimer-1);
    }

    private game:VisualGame|undefined=undefined;
    addToScene(scene: Scene, game:VisualGame) {
        scene.add(this.model);
        this.game=game;
    }
    removeFromScene() {
        this.model.removeFromParent();
    }

    private flipRotation:Quaternion = new Quaternion();
    private flipTimer=0;
    flipFacedown(){
        this.card.flipFacedown();
        this.flipRotation = new Quaternion(0,0,1,0);
        this.flipTimer = 20;
    }
    flipFaceup(){
        this.card.flipFaceup();
        this.flipRotation = new Quaternion(0,0,0,1);
        this.flipTimer = 20;
    }

    private holder:{unchildCard:(g:VisualGame,c:VisualCard)=>any}|undefined=undefined;
    setHolder(holder: { unchildCard: (g: VisualGame, c: VisualCard) => any; } | undefined){
        if(this.holder !== undefined) this.removeFromHolder();
        this.holder=holder;
    }
    removeFromHolder(){
        this.holder?.unchildCard(this.game!,this);
        this.holder=undefined;
    }
}
updateOrder[VisualCard.name] = 0;
