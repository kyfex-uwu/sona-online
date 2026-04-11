import {
    BoxGeometry,
    CylinderGeometry,
    Euler,
    Group,
    Material,
    Mesh,
    MeshBasicMaterial,
    MirroredRepeatWrapping,
    type Object3D,
    Quaternion,
    RepeatWrapping,
    ShaderMaterial,
    Texture,
    Vector3
} from "three";
import {modelLoader, textureLoader, updateOrder} from "./clientConsts.js";
import Card, {Stat} from "../Card.js";
import VisualGame from "./VisualGame.js";
import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import type {CardHoldable} from "./CardHoldable.js";
import {sideTernary, statTernary} from "../consts.js";
import {CardTriggerType} from "../CardData.js";

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
const cardMat = new ShaderMaterial( {
    uniforms: {
        highlight: { value: new Vector3(0,0,0) },
        time:{value:0},
        cardTexture: { value: textureLoader.load("/assets/card-images/card_shape.png") },
        alphaTexture: { value: textureLoader.load("/assets/card-images/card_shape.png") },
        highlightT1: { value:textureLoader.load(`/assets/card-images/highlight1.png`) },
        highlightT2: { value:textureLoader.load(`/assets/card-images/highlight2.png`) },
        highlightT3: { value:textureLoader.load(`/assets/card-images/highlight3.png`) },
        highlightTex: { value:(()=>{
            const toReturn = textureLoader.load(`/assets/card-images/card_shine.png`);
            toReturn.wrapT = MirroredRepeatWrapping;
            toReturn.wrapS = RepeatWrapping;
            return toReturn;
        })() },
        visible:{ value:1 },
    },
    transparent:true,
    vertexShader: `
        varying vec2 vUv; 
    
        void main() {
            vUv = uv;
            
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewPosition; 
        }
      `,
    fragmentShader: `
        varying vec2 vUv; 
        uniform sampler2D cardTexture;
        uniform sampler2D alphaTexture;
        uniform sampler2D highlightT1;
        uniform sampler2D highlightT2;
        uniform sampler2D highlightT3;
        uniform sampler2D highlightTex;
        uniform vec3 highlight;
        uniform float visible;
        uniform float time;
        
        void main() { 
            vec4 color = texture(cardTexture, vUv.xy);
            vec4 shinePos1 = texture(highlightT1, vUv.xy) + vec4(0,0,0,0);
            vec4 shineColor1 = texture(highlightTex, shinePos1.gr * (1.-shinePos1.b));
            vec4 shinePos2 = texture(highlightT2, vUv.xy) + vec4(0,0,0,0);
            vec4 shineColor2 = texture(highlightTex, shinePos2.gr * (1.-shinePos2.b));
            vec4 shinePos3 = texture(highlightT3, vUv.xy) + vec4(0,0,0,0);
            vec4 shineColor3 = texture(highlightTex, shinePos3.gr * (1.-shinePos3.b));
            
            color = color + shineColor1 * shineColor1.a * highlight.x;
            color = color + shineColor2 * shineColor2.a * highlight.y;
            color = color + shineColor3 * shineColor3.a * highlight.z;
            
            gl_FragColor = vec4(color.r+time, color.g, color.b, texture(alphaTexture, vUv.xy).r * visible);
        }`,
} );
const oldCopy = cardMat.copy;
cardMat.copy = (source:Material) => {
    const toReturn = oldCopy(source);
    if(source instanceof ShaderMaterial) {
        toReturn.uniforms = {...source.uniforms};
        toReturn.uniforms.highlight = {value:new Vector3(0,0,0)}
        toReturn.uniforms.visible = {value:1}
    }
    return toReturn;
}

const cardBackMat = cardMat.clone();
cardBackMat.uniforms.cardTexture!.value = textureLoader.load( "/assets/card-images/card_back.jpg");

const cardHighlight = new Mesh(new BoxGeometry(75*1.3,0,100*1.3), new MeshBasicMaterial({
    map:textureLoader.load("/assets/card-images/card_highlight.jpg"),
    alphaMap: textureLoader.load("/assets/card-images/card_highlight_alpha.jpg"),
    transparent: true,
    depthWrite:false,
}));
cardHighlight.position.set(0,-1,0);
cardHighlight.visible=false;

//A *visual* card. This wraps a logical {@link Card}
export default class VisualCard extends PositionedVisualGameElement{
    private _logicalCard:Card;
    public get logicalCard(){
        return this._logicalCard;
    }
    public readonly model: Group = new Group();
    private readonly flipGroup: Group = new Group();
    private _material:ShaderMaterial|undefined;
    private materialListeners:((material:ShaderMaterial|undefined)=>void)[] = [];
    public addMaterialListener(listener:(material:ShaderMaterial|undefined)=>void){
        this.materialListeners.push(listener);
    }
    public get material(){return this._material;}
    private set material(material:ShaderMaterial|undefined){
        this._material = material;
        for(const listener of this.materialListeners) listener(this._material);
    }
    private readonly highlightObj = cardHighlight.clone();

    /**
     * Creates a visual card
     * @param card The logical card this is wrapping
     * @param position The position of this element
     * @param rotation The rotation of this element (optional)
     */
    constructor(game:VisualGame, card: Card, position: Vector3, rotation: Quaternion = new Quaternion()) {
        super(game, card.getSide(), position, rotation);

        this._logicalCard=card;
        this.model.add(this.flipGroup);
        this.model.add(this.highlightObj);
        this.populate(card);

        this.game.scene.add(this.model);
    }

    /**
     * Assigns the logical card to this visual card, and generates a model based on the logical card
     * @param card Logical card to assign to this visual card
     */
    async populate(card:Card){
        this._logicalCard=card;
        this.flipGroup.clear();
        this.model.userData.card=this;
        this.material?.dispose();
        await this.createModel();
    }

    /**
     * Recreates the materials for this card. This should be used when you don't need to recreate the model
     * @param card
     */
    async repopulate(card:Card){
        this._logicalCard=card;

        let texture:Texture|undefined;

        await Promise.all([this.createModel(),
        textureLoader.loadAsync(`/assets/card-images/${card.cardData.imagePath}`).then(t=>{
            texture=t;
        })]);

        //if(this.flipGroup.children[0] !== actualModel) return;

        this.material = cardMat.clone();
        this.material.uniforms.cardTexture!.value = texture!;
        (this.flipGroup.children[0]!.children[0] as Mesh).material = this.material;
    }

    private loadingModel=false;

    //Creates the model for this card
    async createModel(){
        if(this.flipGroup.children.length>0||this.loadingModel) return;
        this.loadingModel=true;
        let actualModel = (await cardModel).clone();
        this.flipGroup.add(actualModel);

        this.material = cardMat.clone();
        (actualModel.children[0] as Mesh).material = this.material;
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

        let resolve;
        const toReturn = new Promise(r=>resolve=r);
        textureLoader.loadAsync(`/assets/card-images/${this.logicalCard.cardData.imagePath}`).then((texture)=>{
            if(this.flipGroup.children[0] !== actualModel) return;

            this.material= cardMat.clone();
            this.material.uniforms.cardTexture!.value = texture!;
            this.material.uniforms.visible!.value = this.logicalCard.cardData.name === "utility"?0:1;
            (actualModel.children[0] as Mesh).material = this.material;
            this.loadingModel=false;
            resolve!();
        });
        return toReturn;
    }

    /**
     * @param stat The stat to return
     * @return The model corresponding to the given stat
     */
    getStatModel(stat:Stat){
        if(this.loadingModel) return;
        return statTernary(stat,
            this.model.userData.redStat,
            this.model.userData.blueStat,
            this.model.userData.yellowStat) as Mesh;
    }

    tick() {
        if(this.game.selectedCard === this) {
            this.position = this.game.cursorPos;
            this.rotation = sideTernary(this.game.getMySide(), new Quaternion(), new Quaternion().setFromEuler(new Euler(0,Math.PI,0)));
        }

        // if(!this.enabled){
        //     (this.model?.children[0]!.children[0] as Mesh).material = this.disabledMaterial!;
        // }else{
        //     (this.model?.children[0]!.children[0] as Mesh).material = this.enabledMaterial!;
        // }
    }

    visualTick() {
        //trust me (working with fake cards that are naughty)
        if(this._logicalCard.callAction) this._logicalCard.callAction(CardTriggerType.VISUAL_TICK, {self:this._logicalCard});

        let targetPos = this.position.clone();
        const targetRot = this.rotation.clone();
        if(this.game.selectedCard === this){
            targetPos.y =
                Math.max.apply(null,this.game.elements
                    .filter(e=>e instanceof VisualCard)
                    .filter(card => card.position.distanceTo(this.position)<70)
                    .map(card => card.position.y))+10;

        }
        targetPos.sub(this.realPosition);
        targetPos = this.realPosition.clone().add(targetPos);
        // if(parent.cursorPos.distanceTo(this.position)<50 && this.faceUp &&
        //     (parent.selectedCard === this || parent.selectedCard === undefined)){
        //     targetPos.lerp(camera.position, 0.5);
        //     // targetRot.slerp(camera.quaternion, 0.5);
        // }
        super.visualTick(targetPos, targetRot);

        this.model.position.copy(this.realPosition);
        this.model.quaternion.copy(this.realRotation);
        this.model.scale.copy(this.realScale);
        this.flipGroup.quaternion.slerp(this.flipRotation,0.1);
        this.flipGroup.position.lerp(new Vector3(0,5*this.flipTimer,0),0.1);
        this.flipTimer=Math.max(0,this.flipTimer-1);
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
        this.removeFromHolder();
        this.holder=holder;
    }

    //Removes the card from its holder, if it has one
    removeFromHolder(){
        this.holder?.removeCard(this);
        this.holder=undefined;
    }

    private highlightLocks:Set<number> = new Set();
    highlight(isHighlighted:boolean, lock:number){
        if(isHighlighted) this.highlightLocks.add(lock);
        else this.highlightLocks.delete(lock);
        this.updateHighlights();
    }
    private updateHighlights(){
        this.highlightObj.visible=this.highlightLocks.size>0;
    }

    private highlightStatLocks: {
        [Stat.RED]:Set<number>,
        [Stat.BLUE]:Set<number>,
        [Stat.YELLOW]:Set<number>,
    } = {
        [Stat.RED]:new Set(),
        [Stat.BLUE]:new Set(),
        [Stat.YELLOW]:new Set(),
    };
    highlightStat(stats:{
        [Stat.RED]?:boolean,
        [Stat.BLUE]?:boolean,
        [Stat.YELLOW]?:boolean,
    }, lock:number){
        for(const stat of [Stat.RED, Stat.BLUE, Stat.YELLOW])
            if(stats[stat] !== undefined) {
                if (stats[stat]) this.highlightStatLocks[stat].add(lock);
                else this.highlightStatLocks[stat].delete(lock);
            }
        this.updateStatHighlights();
    }
    private updateStatHighlights(){
        (this.material!.uniforms.highlight!.value as Vector3).x=this.highlightStatLocks[Stat.RED].size>0?1:0;
        (this.material!.uniforms.highlight!.value as Vector3).y=this.highlightStatLocks[Stat.BLUE].size>0?1:0;
        (this.material!.uniforms.highlight!.value as Vector3).z=this.highlightStatLocks[Stat.YELLOW].size>0?1:0;
    }

    static getExactVisualCard(obj:any){
        return obj.constructor === VisualCard ? obj : undefined;
    }
}
updateOrder[VisualCard.name] = 0;

let lock=0;
export function newHighlightLock(){
    return lock++;
}