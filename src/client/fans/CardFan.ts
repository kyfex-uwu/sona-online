import {Side} from "../../GameElement.js";
import {Euler, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, type Scene, Vector3} from "three";
import {PositionedVisualGameElement} from "../PositionedVisualGameElement.js";
import VisualCard from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {clickListener, removeClickListener} from "../clientConsts.js";
import type {CardHoldable} from "../CardHoldable.js";
import type {SidedVisualGameElement} from "../VisualGameElement.js";

export default class CardFan extends PositionedVisualGameElement implements CardHoldable, SidedVisualGameElement{

    public readonly cards: Array<VisualCard> = [];

    protected readonly group: Group = new Group();
    private readonly onSelect:(card:VisualCard, game:VisualGame)=>void;
    private readonly fakeCard:Group;

    /**
     * Creates a card fan
     * @param side Which side this element belongs to
     * @param position The starting position of this element
     * @param props Optional data
     * @param onSelect The function to run when a card in this fan is selected
     * @param rotation The rotation of this element
     */
    constructor(side:Side, position: Vector3, props?: {
        onSelect: (card: VisualCard, game: VisualGame) => void;
        rotation?: Quaternion
    }) {
        props = Object.assign({
            rotation:new Quaternion(),
            onSelect:()=>{},
        },props);
        super(side, position, props.rotation!);

        this.onSelect=props.onSelect!;

        this.fakeCard = new Group();
        const mesh = new Mesh(new PlaneGeometry(100,100), new MeshBasicMaterial({visible:false}));
        mesh.rotateX(-Math.PI/2);
        this.fakeCard.add(mesh);
        this.group.add(this.fakeCard);
    }

    private listener:number=-1;
    addToGame(game: VisualGame): void {
        super.addToGame(game);
        game.scene.add(this.group);

        this.listener=clickListener(()=>{
            const intersects = game.raycaster.intersectObjects(this.cards
                .map(card => card.model).filter(model => model !== undefined)
                .concat(...(this.cards.length !== 0 ? []:[this.fakeCard as Group])));
            if (intersects[0] !== undefined) {
                this.onSelect(((intersects[0].object.parent!.parent!.parent! as Group).userData.card as VisualCard), game);
            }
            return false;
        });
    }
    removeFromGame() {
        super.removeFromGame();
        removeClickListener(this.listener);
        this.group.removeFromParent();
    }

    visualTick(parent: VisualGame): void {
        this.group.position.lerp(this.position, 0.1);
        this.group.quaternion.slerp(this.rotation, 0.1);
    }

    addCard(game:VisualGame, card:VisualCard, index:number=0){
        this.cards.splice(index,0,card);
        card.setHolder(this);

        card.createModel().then(()=>{
            this.recalculateCardPositions();
            card.setRealPosition(this.group.worldToLocal(card.model?.position!));
            card.setRealRotation(this.group.quaternion.clone().premultiply(card.model?.getWorldQuaternion(new Quaternion()).invert()!));
            this.group.add(card.model!);
        });
    }
    removeCard(game:VisualGame, card:VisualCard){
        if(this.cards.indexOf(card)>=0) this.cards.splice(this.cards.indexOf(card),1);
        this.recalculateCardPositions();

        this.unchildCard(game, card);
    }

    //Recalculates where each card should be in this hand, and moves them to that position
    recalculateCardPositions(){
        let pos = -(this.cards.length-1)/2;
        const posInc = 100-Math.log(this.cards.length)*30;
        const radius = this.cards.length;
        for(const card of this.cards){
            card.position = new Vector3(posInc*radius*Math.sin(pos/radius),0,posInc*(-Math.cos(pos/radius)+0.9)*radius*3/5);
            card.rotation.slerp(new Quaternion().setFromEuler(new Euler(0,Math.PI*pos*-0.02,-0.01)),1);
            pos++;
        }
    }
    unchildCard(game:VisualGame, card:VisualCard){
        card.rotation = new Quaternion();
        card.setRealPosition(card.model?.getWorldPosition(new Vector3())!);
        card.setRealRotation(card.model?.getWorldQuaternion(new Quaternion())!);
        game.scene.add(card.model!);
    }

    tick(parent: VisualGame): void {
    }
}
