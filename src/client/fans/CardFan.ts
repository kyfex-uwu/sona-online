import {Side} from "../../GameElement.js";
import {Euler, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, type Scene, Vector3} from "three";
import {PositionedVisualGameElement} from "../PositionedVisualGameElement.js";
import type VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";
import {clickListener, removeClickListener} from "../clientConsts.js";

export default class CardFan extends PositionedVisualGameElement{

    public readonly cards: Array<VisualCard> = [];

    protected readonly group: Group = new Group();
    private readonly onSelect:(card:VisualCard, parent:VisualGame)=>void;
    private readonly fakeCard:Group;

    constructor(side:Side, position: Vector3, params?: {
        onSelect: (card: VisualCard, game: VisualGame) => void;
        rotation?: Quaternion
    }) {
        params = Object.assign({
            rotation:new Quaternion(),
            onSelect:()=>{},
        },params);
        super(side, position, params.rotation!);

        this.onSelect=params.onSelect!;

        this.fakeCard = new Group();
        const mesh = new Mesh(new PlaneGeometry(100,100), new MeshBasicMaterial({visible:false}));
        mesh.rotateX(-Math.PI/2);
        this.fakeCard.add(mesh);
        this.group.add(this.fakeCard);
    }

    private listener:number=-1;
    addToScene(scene: Scene, parent: VisualGame): void {
        scene.add(this.group);

        this.listener=clickListener(()=>{
            const intersects = parent.raycaster.intersectObjects(this.cards
                .map(card => card.model).filter(model => model !== undefined)
                .concat(...(this.cards.length !== 0 ? []:[this.fakeCard as Group])));
            if (intersects[0] !== undefined) {
                this.onSelect(((intersects[0].object.parent!.parent!.parent! as Group).userData.card as VisualCard), parent);
            }
            return false;
        });
    }
    removeFromScene() {
        removeClickListener(this.listener);
        this.group.parent?.remove(this.group);
    }

    visualTick(parent: VisualGame): void {
        this.group.position.lerp(this.position, 0.1);
        this.group.quaternion.slerp(this.rotation, 0.1);
    }

    addCard(card:VisualCard, index:number=0){
        this.cards.splice(index,0,card);
        card.setHolder(this);

        card.createModel().then(()=>{
            this.recalculateCardPositions();
            card.setRealPosition(this.group.worldToLocal(card.model?.position!));
            card.setRealRotation(this.group.quaternion.clone().premultiply(card.model?.getWorldQuaternion(new Quaternion()).invert()!));
            this.group.add(card.model!);
        })
    }
    recalculateCardPositions(){
        let pos = -(this.cards.length-1)/2;
        const posInc = 100-Math.log(this.cards.length)*30;
        const radius = this.cards.length;
        for(const card of this.cards){
            card.position = new Vector3(posInc*radius*Math.sin(pos/radius),0,posInc*(-Math.cos(pos/radius)+0.9)*radius*3/5);
            card.rotation.slerp(new Quaternion().setFromEuler(new Euler(0,Math.PI*pos*-0.02,-0.01)),1)
            pos++;
        }
    }
    unchildCard(game:VisualGame, card:VisualCard){
        let index = this.cards.indexOf(card);
        if(index===-1) return;
        this.cards.splice(this.cards.indexOf(card),1);
        this.recalculateCardPositions();

        card.rotation = new Quaternion();
        card.setRealPosition(card.model?.getWorldPosition(new Vector3())!);
        card.setRealRotation(card.model?.getWorldQuaternion(new Quaternion())!);
        game.scene.add(card.model!);
    }
}
