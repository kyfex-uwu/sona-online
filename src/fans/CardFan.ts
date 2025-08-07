import {
    Euler,
    Group,
    Mesh,
    MeshBasicMaterial,
    type Object3D,
    PlaneGeometry,
    Quaternion,
    type Scene,
    Vector3
} from "three";
import Card from "../Card.js";
import {type GameElement, Side} from "../GameElement.js";
import type Game from "../Game.js";
import {clickListener} from "../consts.js";


export default class CardFan implements GameElement{
    public readonly position:Vector3;
    public readonly rotation:Quaternion;
    public readonly cards: Array<Card> = [];
    protected readonly group: Group = new Group();
    private readonly onSelect:(card:Card, scene:Scene, parent:Game)=>void;
    private readonly side:Side;
    private readonly fakeCard:Group;

    constructor(position: Vector3, side:Side, params?: {
        onSelect: (card: Card, scene: Scene, game: Game) => void;
        rotation?: Quaternion
    }) {
        this.side=side;
        params = Object.assign({
            rotation:new Quaternion(),
            onSelect:()=>{},
        },params);

        this.position = position;
        this.rotation = params.rotation!;
        this.onSelect=params.onSelect!;

        this.fakeCard = new Group();
        const mesh = new Mesh(new PlaneGeometry(100,100), new MeshBasicMaterial({visible:false}));
        mesh.rotateX(-Math.PI/2);
        this.fakeCard.add(mesh);
        this.group.add(this.fakeCard);
    }

    addToScene(scene: Scene, parent: Game): void {
        scene.add(this.group);

        clickListener(()=>{
            const intersects = parent.raycaster.intersectObjects(this.cards
                .map(card => card.model).filter(model => model !== undefined)
                .concat(...(this.cards.length !== 0 ? []:[this.fakeCard as Group])));
            if (intersects[0] !== undefined) {
                this.onSelect(((intersects[0].object.parent!.parent! as Group).userData.card as Card), scene, parent);
            }
            return false;
        });
    }
    tick(parent: Game): void {
    }
    visualTick(parent: Game): void {
        this.group.position.lerp(this.position, 0.1);
        this.group.quaternion.slerp(this.rotation, 0.1);
    }

    addCard(card:Card, index:number=0){
        this.cards.splice(index,0,card);
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
    getSide(){ return this.side; }
}
