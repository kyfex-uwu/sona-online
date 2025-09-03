import {Euler, Mesh, type Object3D, PlaneGeometry, Quaternion, Raycaster, type Scene, Vector2, Vector3} from "three";
import FieldMagnet from "./magnets/FieldMagnet.js";
import RunawayMagnet from "./magnets/RunawayMagnet.js";
import DeckMagnet from "./magnets/DeckMagnet.js";
import HandFan from "./fans/HandFan.js";
import VisualHandFan from "./fans/HandFan.js";
import Game from "../Game.js";
import VisualCard from "./VisualCard.js";
import type {VisualGameElement} from "./VisualGameElement.js";
import {other, Side} from "../GameElement.js";
import {camera, updateOrder} from "./clientConsts.js";
import {Event} from "../networking/Events.js";
import {registerDrawCallback} from "./ui.js";
import type Card from "../Card.js";
import p5 from "p5";
import {BeforeGameState, type GameState} from "../GameStates.js";

const pointer = new Vector2();

window.addEventListener("pointermove", ( event: { clientX: number; clientY: number; } )=> {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
})
const geo = new Mesh(new PlaneGeometry(999999,999999).rotateX(-Math.PI/2));

export enum ViewType{
    WHOLE_BOARD_YOU,
    WHOLE_BOARD_THEM,
    FIELDS,
}
export enum CurrentTurn{
    YOURS,
    THEIRS,
    NEITHER,
}
export enum ElementType{
    FIELD_1,
    FIELD_2,
    FIELD_3,
    RUNAWAY,
    DECK,
    HAND
}
export function getField(index:1|2|3){
    switch(index){
        case 1: return ElementType.FIELD_1;
        case 2: return ElementType.FIELD_2;
        case 3: return ElementType.FIELD_3;
    }
}

const previewImages:{[k:string]:p5.Image|true} = {};

export default class VisualGame {
    private game: Game;
    public getGame():Game{ return this.game; }
    public setGame(g:Game):void{ this.game = g; }
    public selectedCard: VisualCard | undefined;
    public readonly elements: VisualGameElement[] = [];
    public readonly scene: Scene;
    public cursorPos = new Vector3();
    public readonly raycaster = new Raycaster();

    public readonly fieldsA: [FieldMagnet, FieldMagnet, FieldMagnet] =
        [{} as FieldMagnet, {} as FieldMagnet, {} as FieldMagnet];
    public readonly runawayA: RunawayMagnet;
    public readonly deckA: DeckMagnet;
    public readonly handA: VisualHandFan;
    public readonly fieldsB: [FieldMagnet, FieldMagnet, FieldMagnet] =
        [{} as FieldMagnet, {} as FieldMagnet, {} as FieldMagnet];
    public readonly runawayB: RunawayMagnet;
    public readonly deckB: DeckMagnet;
    public readonly handB: VisualHandFan;

    public currentTurn: CurrentTurn = CurrentTurn.NEITHER;
    public actionsLeft = 0;
    public processingAction = false;

    private previewCard:Card|undefined;

    private state:GameState = new BeforeGameState();

    public constructor(scene: Scene) {
        this.scene = scene;
        this.game = new Game([],[],Game.localID);

        this.fieldsA[0] = this.addElement(new FieldMagnet(new Vector3(100, 0, 70), Side.A, 1));
        this.fieldsA[1] = this.addElement(new FieldMagnet(new Vector3(0, 0, 70), Side.A, 2));
        this.fieldsA[2] = this.addElement(new FieldMagnet(new Vector3(-100, 0, 70), Side.A, 3));
        this.runawayA = this.addElement(new RunawayMagnet(new Vector3(-200, 0, 200), Side.A));
        this.deckA = this.addElement(new DeckMagnet(new Vector3(200, 0, 200), Side.A));
        this.handA = this.addElement(new HandFan(new Vector3(0, 0, 200), Side.A));

        this.fieldsB[0] = this.addElement(new FieldMagnet(new Vector3(100, 0, -70), Side.B, 1, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.fieldsB[1] = this.addElement(new FieldMagnet(new Vector3(0, 0, -70), Side.B, 2, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.fieldsB[2] = this.addElement(new FieldMagnet(new Vector3(-100, 0, -70), Side.B, 3, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.runawayB = this.addElement(new RunawayMagnet(new Vector3(200, 0, -200), Side.B, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.deckB = this.addElement(new DeckMagnet(new Vector3(-200, 0, -200), Side.B, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.handB = this.addElement(new HandFan(new Vector3(0, 0, -200), Side.B, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));

        //crisis markers

        //--

        this.releaseDrawCallback = registerDrawCallback(0, (p5, scale)=>{
            if(this.previewCard === undefined) return;
            if(previewImages[this.previewCard.cardData.imagePath] !== undefined){
                if(previewImages[this.previewCard.cardData.imagePath] !== true) {
                    p5.image(previewImages[this.previewCard.cardData.imagePath],
                        p5.width - 50 * scale / 45, (p5.height - 70 * scale / 45) / 2, 50 * scale / 45, 70 * scale / 45);
                }
            }else{
                previewImages[this.previewCard.cardData.imagePath]=true;
                const path = this.previewCard.cardData.imagePath
                p5.loadImage(`/assets/card-images/${path}.jpg`, (image:p5.Image) => {
                    previewImages[path]=image;//.mask(the card mask)
                })
            }
        })
    }
    private readonly releaseDrawCallback;

    public addElement<T extends VisualGameElement>(element: T): T {
        element.addToScene(this.scene, this);
        this.elements.push(element);

        this.elements.sort((e1, e2) => {
            return (updateOrder[e2.constructor.name] || 999999) - (updateOrder[e1.constructor.name] || 999999);
        });

        return element;
    }

    public tick() {
        this.raycaster.setFromCamera(pointer, camera);
        const intersects = this.raycaster.intersectObjects([geo]);
        if (intersects[0] !== undefined) {
            this.cursorPos = intersects[0].point;
        }

        let shouldRemovePreview=true;
        const cardsIntersects = this.raycaster.intersectObjects([
            ...this.fieldsA.filter(field=>field.getCard()?.card?.getFaceUp()).map(field => field.getCard()?.model),
            ...this.fieldsB.filter(field=>field.getCard()?.card?.getFaceUp()).map(field => field.getCard()?.model),
            ...this.handA.cards.filter(vCard=>vCard.card.getFaceUp())//&&vCard.card.cardData!==cards.unknown
                .map(field => field.model),
            ...this.handB.cards.filter(vCard=>vCard.card.getFaceUp())//&&vCard.card.cardData!==cards.unknown
                .map(field => field.model),

        ].filter(v=>v!==undefined));
        if(cardsIntersects[0] !== undefined){
            const visualCardMaybe = cardsIntersects[0].object.parent?.parent?.parent?.userData.card as VisualCard|undefined;
            if(visualCardMaybe instanceof VisualCard){
                shouldRemovePreview = false;
                if(this.previewCard?.cardData.id !==
                    visualCardMaybe.card.cardData.id) {
                    const wasPreviewCard = this.previewCard !== undefined;
                    setTimeout(()=>{
                        this.previewCard = visualCardMaybe.card;
                        const old = this.previewCard;
                        setTimeout(async ()=>{
                            if(this.previewCard===old){
                                //todo: display only in here
                            }
                        },wasPreviewCard?0:500);
                    },0)
                    shouldRemovePreview = false;
                }
            }
        }
        if(shouldRemovePreview){
            this.previewCard = undefined;
        }

        for (const element of this.elements) element.tick(this);
    }

    public visualTick() {
        for (const element of this.elements) element.visualTick(this);
    }

    public changeView(type: ViewType) {
        switch (type) {
            case ViewType.WHOLE_BOARD_YOU:
                camera.position.copy(new Vector3(0, 600, 220));
                camera.rotation.copy(new Euler(-Math.PI * 0.4, 0, 0));
                break;
            case ViewType.WHOLE_BOARD_THEM:
                camera.position.copy(new Vector3(0, 600, -220));
                camera.rotation.copy(new Euler(-Math.PI * 0.6, 0, Math.PI));
                break;
            case ViewType.FIELDS:
                camera.position.copy(new Vector3(0, 450, 20));
                camera.rotation.copy(new Euler(-Math.PI * 0.5, 0, 0));
                break;
        }
    }

    getMy(type:ElementType):VisualGameElement{
        return this.get(this.game.side,type);
    }
    getTheir(type:ElementType):VisualGameElement{
        return this.get(other(this.game.side),type);
    }
    get(side:Side, type:ElementType){
        switch(type){
            case ElementType.DECK: return side == Side.A ? this.deckA : this.deckB;
            case ElementType.FIELD_1: return side == Side.A ? this.fieldsA[0] : this.fieldsB[0];
            case ElementType.FIELD_2: return side == Side.A ? this.fieldsA[1] : this.fieldsB[1];
            case ElementType.FIELD_3: return side == Side.A ? this.fieldsA[2] : this.fieldsB[2];
            case ElementType.HAND: return side == Side.A ? this.handA : this.handB;
            case ElementType.RUNAWAY: return side == Side.A ? this.runawayA : this.runawayB;
        }
    }

    // requestStart() {
    //     for (const field of this.yourFields) field.removeCard(this);
    //     for (const field of this.theirFields) field.removeCard(this);
    //     while (this.yourDeck.removeCard(this)) {}
    //     while (this.theirDeck.removeCard(this)) {}
    //     while (this.yourRunaway.removeCard(this)) {}
    //     while (this.theirRunaway.removeCard(this)) {}
    //
    //     this.currentTurn = CurrentTurn.NEITHER;
    //     this.actionsLeft = 0;
    //
    //     this.sendEvent(new StartRequestEvent({
    //         side:this.game.side,
    //     }, this.game));
    // }
    sendEvent(event:Event<any>){
        this.game.requestEvent(event);
    }

    // load(yourDeck:CardTemplate[], theirDeck:CardTemplate[]){
    //     //shuffle animation?
    //     for(const template of shuffled(yourDeck)){
    //         this.yourDeck.addCard(this, this.addElement(template(this.yourDeck.position.clone(), Side.YOU, this.yourDeck.rotation.clone())));
    //     }
    //     for(const template of shuffled(theirDeck)){
    //         this.theirDeck.addCard(this, this.addElement(template(this.theirDeck.position.clone(), Side.THEM, this.theirDeck.rotation.clone())));
    //     }
    // }

    release(){
        this.releaseDrawCallback();
        this.scene.removeFromParent();
    }

    logicTick(){
        // this.state.visualTick(this);
    }
}
