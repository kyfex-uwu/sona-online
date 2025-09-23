import {
    Color, CylinderGeometry,
    Euler,
    Group,
    Material,
    Mesh,
    MeshBasicMaterial, MeshPhongMaterial,
    type Object3D,
    Quaternion,
    type Scene,
    Texture,
    Vector3
} from "three";
import {modelLoader, textureLoader, updateOrder} from "./clientConsts.js";
import Card, {Stat} from "../Card.js";
import VisualGame from "./VisualGame.js";
import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import {game} from "../index.js";
import {cSideTernary} from "./clientConsts.js";
import type {CardHoldable} from "./CardHoldable.js";

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
const cardMat = new MeshPhongMaterial({
    alphaMap: textureLoader.load("/assets/card-images/card_shape.png"),
    transparent: true,
    emissive: new Color(0x000000),
    specular: new Color(0xffffff),
    shininess: 150,
});
const cardBackMat = cardMat.clone();
cardBackMat.map = textureLoader.load( "/assets/card-images/card_back.jpg")

//A *visual* card. This wraps a logical {@link Card}
export default class VisualCard extends PositionedVisualGameElement{
    private _logicalCard:Card;
    public get logicalCard(){
        return this._logicalCard;
    }
    public readonly model: Group = new Group();
    private readonly flipGroup: Group = new Group();
    private enabledMaterial:MeshPhongMaterial|undefined;
    private disabledMaterial:MeshPhongMaterial|undefined;

    /**
     * Creates a visual card
     * @param card The logical card this is wrapping
     * @param position The position of this element
     * @param rotation The rotation of this element (optional)
     */
    constructor(card: Card, position: Vector3, rotation: Quaternion = new Quaternion()) {
        super(card.getSide(), position, rotation);

        this._logicalCard=card;
        this.model.add(this.flipGroup);
        this.populate(card);
    }

    /**
     * Assigns the logical card to this visual card, and generates a model based on the logical card
     * @param card Logical card to assign to this visual card
     */
    populate(card:Card){
        this._logicalCard=card;
        this.flipGroup.clear();
        this.model.userData.card=this;
        this.enabledMaterial?.dispose();
        this.disabledMaterial?.dispose();
        this.createModel();
    }

    /**
     * Recreates the materials for this card. This should be used when you don't need to recreate the model
     * @param card
     */
    async repopulate(card:Card){
        this._logicalCard=card;

        let texture:Texture|undefined;

        await Promise.all([this.createModel(),
        textureLoader.loadAsync(`/assets/card-images/${card.cardData.imagePath}.jpg`).then(t=>{
            texture=t;
        })]);

        //if(this.flipGroup.children[0] !== actualModel) return;

        this.enabledMaterial= cardMat.clone();
        this.enabledMaterial.map = texture!;
        this.disabledMaterial= cardMat.clone();
        this.disabledMaterial.map = texture!;
        this.disabledMaterial.color = new Color(0x777777);
        (this.flipGroup.children[0]!.children[0] as Mesh).material = this.enabledMaterial;
    }

    private loadingModel=false;

    //Creates the model for this card
    async createModel(){
        if(this.flipGroup.children.length>0||this.loadingModel) return;
        this.loadingModel=true;
        let actualModel = (await cardModel).clone();
        this.flipGroup.add(actualModel);

        this.enabledMaterial = cardMat.clone();
        this.disabledMaterial = cardMat.clone();
        (actualModel.children[0] as Mesh).material = this.enabledMaterial;
        (actualModel.children[1] as Mesh).material = cardBackMat;

        this.model.userData.redStat = new Mesh(new CylinderGeometry(7.777,7.777), new MeshBasicMaterial({
            visible:false
        }));
        this.model.userData.blueStat = new Mesh(new CylinderGeometry(7.777,7.777), new MeshBasicMaterial({
            visible:false
        }));
        this.model.userData.yellowStat = new Mesh(new CylinderGeometry(7.777,7.777), new MeshBasicMaterial({
            visible:false
        }));
        this.model.userData.redStat.position.set(-20,0,-38.3);
        this.model.userData.blueStat.position.set(0,0,-38.3);
        this.model.userData.yellowStat.position.set(20,0,-38.3);
        actualModel.add(this.model.userData.redStat);
        actualModel.add(this.model.userData.blueStat);
        actualModel.add(this.model.userData.yellowStat);

        textureLoader.loadAsync(`/assets/card-images/${this.logicalCard.cardData.imagePath}.jpg`).then((texture)=>{
            if(this.flipGroup.children[0] !== actualModel) return;

            this.enabledMaterial= cardMat.clone();
            this.enabledMaterial.map = texture!;
            this.disabledMaterial= cardMat.clone();
            this.disabledMaterial.map = texture!;
            this.disabledMaterial.color = new Color(0x777777);
            console.log("b");//???
            (actualModel.children[0] as Mesh).material = this.enabledMaterial;
            this.loadingModel=false;
        });
    }

    /**
     * @param stat The stat to return
     * @return The model corresponding to the given stat
     */
    getStatModel(stat:Stat){
        if(this.loadingModel) return;
        switch(stat){
            case Stat.RED:
                return this.model.userData.redStat as Mesh;
            case Stat.BLUE:
                return this.model.userData.blueStat as Mesh;
            case Stat.YELLOW:
                return this.model.userData.yellowStat as Mesh;
        }
    }

    tick(parent: VisualGame) {
        if(parent.selectedCard === this) {
            this.position = parent.cursorPos;
            this.rotation = cSideTernary(game, new Quaternion(), new Quaternion().setFromEuler(new Euler(0,Math.PI,0)));
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
        targetPos.sub(this.realPosition);
        if(targetPos.length()>50) targetPos.multiplyScalar(Math.max(1-(targetPos.length()-50)*0.005,0.5));
        targetPos = this.realPosition.clone().add(targetPos);
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

    addToGame(game:VisualGame) {
        super.addToGame(game);
        game.scene.add(this.model);
    }
    removeFromGame() {
        super.removeFromGame();
        this.model.removeFromParent();
    }

    private flipRotation:Quaternion = new Quaternion();
    private flipTimer=0;

    //Flips both this visual card and its logical card facedown
    flipFacedown(){
        if(!this.logicalCard.getFaceUp()) return;
        this.logicalCard.flipFacedown();
        this.flipRotation = new Quaternion(0,0,1,0);
        this.flipTimer = 20;
    }
    //Flips both this visual card and its logical card faceup
    flipFaceup(){
        if(this.logicalCard.getFaceUp()) return;
        this.logicalCard.flipFaceup();
        this.flipRotation = new Quaternion(0,0,0,1);
        this.flipTimer = 20;
    }

    private holder:CardHoldable|undefined=undefined;

    //@return The thing holding this card
    public getHolder(){ return this.holder; }

    /**
     * Removes the card from any old holder and put it in the new holder
     * @param holder
     */
    setHolder(holder: CardHoldable | undefined){
        if(this.holder !== undefined) this.removeFromHolder();
        this.holder=holder;
    }

    //Removes the card from its holder, if it has one
    removeFromHolder(){
        this.holder?.unchildCard(this.game!,this);
        this.holder=undefined;
    }
}
updateOrder[VisualCard.name] = 0;
