import {Euler, Mesh, Object3D, PlaneGeometry, Quaternion, Raycaster, type Scene, Vector2, Vector3} from "three";
import FieldMagnet from "./magnets/FieldMagnet.js";
import RunawayMagnet from "./magnets/RunawayMagnet.js";
import DeckMagnet from "./magnets/DeckMagnet.js";
import HandFan from "./fans/HandFan.js";
import VisualHandFan from "./fans/HandFan.js";
import Game from "../Game.js";
import VisualCard from "./VisualCard.js";
import type {VisualGameElement} from "./VisualGameElement.js";
import {Side} from "../GameElement.js";
import {camera, updateOrder} from "./clientConsts.js";
import {Event, PassAction} from "../networking/Events.js";
import {button, buttonId, registerDrawCallback} from "./ui.js";
import type Card from "../Card.js";
import p5 from "p5";
import {
    type Cancellable,
    isCancellable,
    VAttackingState,
    VBeforeGameState,
    type VisualGameState,
    VTurnState
} from "./VisualGameStates.js";
import type {GameState} from "../GameStates.js";
import {successOrFail} from "../networking/Server.js";
import {sideTernary} from "../consts.js";

const pointer = new Vector2();

window.addEventListener("pointermove", ( event: { clientX: number; clientY: number; } )=> {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
})
const geo = new Mesh(new PlaneGeometry(999999,999999).rotateX(-Math.PI/2));

//The camera view
export enum ViewType{
    WHOLE_BOARD_A,
    WHOLE_BOARD_B,
    FIELDS_A,
    FIELDS_B,
}

const previewImages:{[k:string]:p5.Image|true} = {};

//A *visual* game. This should manage everything that's part of the player's game experience. This wraps a logical {@link Game}
export default class VisualGame {
    private game: Game;
    //Returns the logical game
    public getGame():Game{ return this.game; }
    public selectedCard: VisualCard | undefined;
    public readonly elements: VisualGameElement[] = [];
    public readonly scene: Scene;
    public cursorPos = new Vector3();
    public readonly raycaster = new Raycaster();

    public frozen=false;

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

    private previewCard:Card|undefined;
    private drawPreviewCard=false;

    private readonly passButtonId;

    private targetCameraPos = new Vector3();
    private targetCameraRot = new Quaternion();

    private _state:VisualGameState<GameState> = new VBeforeGameState(this);
    public get state(){ return this._state; }

    /**
     * Sets both the visual game's state and the logical game's state
     * @param newVState The new visual state
     * @param newState The new logical state
     */
    public setState<T extends GameState>(newVState:VisualGameState<T>, newState:T){
        const oldState = this.state;
        this._state = newVState;
        this.game.state = newState;
        oldState.swapAway();
        newVState.init();
    }
    public debugLast="";

    /**
     * Creates a new visual game
     * @param scene The ThreeJS scene for this game
     */
    public constructor(scene: Scene) {
        this.scene = scene;
        this.game = new Game([],[],Game.localID+Math.random());

        this.fieldsA[0] = this.addElement(new FieldMagnet(this, new Vector3(100, 0, 70), Side.A, 1));
        this.fieldsA[1] = this.addElement(new FieldMagnet(this, new Vector3(0, 0, 70), Side.A, 2));
        this.fieldsA[2] = this.addElement(new FieldMagnet(this, new Vector3(-100, 0, 70), Side.A, 3));
        this.runawayA = this.addElement(new RunawayMagnet(this, new Vector3(-200, 0, 200), Side.A));
        this.deckA = this.addElement(new DeckMagnet(this, new Vector3(200, 0, 200), Side.A));
        this.handA = this.addElement(new HandFan(this, new Vector3(0, 0, 200), Side.A));

        this.fieldsB[0] = this.addElement(new FieldMagnet(this, new Vector3(100, 0, -70), Side.B, 1, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.fieldsB[1] = this.addElement(new FieldMagnet(this, new Vector3(0, 0, -70), Side.B, 2, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.fieldsB[2] = this.addElement(new FieldMagnet(this, new Vector3(-100, 0, -70), Side.B, 3, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.runawayB = this.addElement(new RunawayMagnet(this, new Vector3(200, 0, -200), Side.B, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.deckB = this.addElement(new DeckMagnet(this, new Vector3(-200, 0, -200), Side.B, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));
        this.handB = this.addElement(new HandFan(this, new Vector3(0, 0, -200), Side.B, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));

        //crisis markers

        this.state.init();//one-time fix for starting state

        //--

        this.passButtonId = buttonId();
        this.releaseDrawCallback = registerDrawCallback(0, (p5, scale)=>{
            if(this.previewCard !== undefined && this.drawPreviewCard) {
                if (previewImages[this.previewCard.cardData.imagePath] !== undefined) {
                    if (previewImages[this.previewCard.cardData.imagePath] !== true) {
                        p5.image(previewImages[this.previewCard.cardData.imagePath],
                            p5.width - 50 * scale / 45, (p5.height - 70 * scale / 45) / 2, 50 * scale / 45, 70 * scale / 45);
                    }
                } else {
                    previewImages[this.previewCard.cardData.imagePath] = true;
                    const path = this.previewCard.cardData.imagePath
                    p5.loadImage(`/assets/card-images/${path}`, (image: p5.Image) => {
                        previewImages[path] = image;//.mask(the card mask)
                    })
                }
            }

            if(this.state instanceof VTurnState && this.state.getNonVisState().turn === this.getMySide()){
                let width=scale*1.3;
                let height=scale*0.4;
                button(p5, p5.width/2-width/2, p5.height-height-scale*0.1, width, height, "Pass", ()=>{
                    this.frozen=true;
                    this.sendEvent(new PassAction({})).onReply(successOrFail(() => {
                        (this.state as VTurnState).decrementTurn();
                    },undefined,()=>{
                        this.frozen=false;
                    }));
                }, scale, this.passButtonId, sideTernary(this.getMySide(), this.game.handA, this.game.handB).length>5);
            }
            if(isCancellable(this.state)){
                let width=scale*1.3;
                let height=scale*0.4;
                button(p5, p5.width/2-width/2, p5.height-height-scale*0.1, width, height, "Cancel", ()=>{
                    (this.state as unknown as Cancellable).cancel();//trust
                }, scale, this.passButtonId);
            }
        });
        this.releaseDebugDraw = registerDrawCallback(1000, (p5, scale) =>{
            p5.push();
            p5.fill(255,0,0);
            p5.textSize(scale*0.1);
            p5.textAlign(p5.LEFT,p5.TOP);
            if(this.state instanceof VTurnState){
                p5.text(`side ${Side[this.getMySide()]}
${this.state.getNonVisState().turn?"A":"B"}
${this.state.getActionsLeft()}`, 0,0);
            }
            if(this.state instanceof VAttackingState){
                p5.text(`${this.state.attackData.type}\n${sideTernary(this.getMySide(), this.fieldsA, this.fieldsB)[this.state.cardIndex-1]!
                    .getCard()?.logicalCard.cardData.stats.toString()}`, 0,0);
            }

            p5.textAlign(p5.LEFT,p5.BOTTOM);
            p5.text(this.debugLast, 0,p5.height);

            if(this.previewCard !== undefined){
                p5.textAlign(p5.RIGHT,p5.TOP);
                p5.text(this.previewCard.cardData.stats.join(","), p5.width,0);
            }

            p5.pop();
        });
    }
    private readonly releaseDrawCallback;
    private readonly releaseDebugDraw;

    /**
     * Adds the element to this game
     * @param element The element to add
     */
    public addElement<T extends VisualGameElement>(element: T): T {
        this.elements.push(element);

        this.elements.sort((e1, e2) => {
            return (updateOrder[e2.constructor.name] || 999999) - (updateOrder[e1.constructor.name] || 999999);
        });

        return element;
    }

    public cursorActive = true;

    //Handles the 3d cursor and ticks all game elements
    public tick() {
        if(!this.cursorActive) {
            this.raycaster.set(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
            return;
        }

        this.raycaster.setFromCamera(pointer, camera);
        const intersects = this.raycaster.intersectObjects([geo]);
        if (intersects[0] !== undefined) {
            this.cursorPos = intersects[0].point;
        }

        let shouldRemovePreview=true;
        const cardsIntersects = this.raycaster.intersectObjects([
            ...this.elements.filter(element => element instanceof VisualCard && element.logicalCard.getFaceUp())
                .map(card => (card as VisualCard).model)
        ].filter(v=>v!==undefined));
        if(cardsIntersects[0] !== undefined){
            const visualCardMaybe = cardsIntersects[0].object.parent?.parent?.parent?.userData.card as VisualCard|undefined;
            if(visualCardMaybe instanceof VisualCard){
                shouldRemovePreview = false;
                if(this.previewCard?.cardData.id !==
                    visualCardMaybe.logicalCard.cardData.id) {
                    const wasPreviewCard = this.previewCard !== undefined && this.drawPreviewCard;
                    setTimeout(()=>{
                        this.previewCard = visualCardMaybe.logicalCard;
                        const old = this.previewCard;
                        setTimeout(async ()=>{
                            if(this.previewCard===old){
                                this.drawPreviewCard=true;
                            }
                        },wasPreviewCard?0:400);
                    },0)
                    shouldRemovePreview = false;
                }
            }
        }
        if(shouldRemovePreview){
            this.drawPreviewCard=false;
            this.previewCard = undefined;
        }

        for (const element of this.elements) element.tick();
    }

    //Visually ticks all the game elements and the camera
    public visualTick() {
        for (const element of this.elements) element.visualTick();
        this.state.visualTick();

        camera.position.lerp(this.targetCameraPos, 0.1);
        camera.quaternion.slerp(this.targetCameraRot, 0.1);
    }

    /**
     * Changes the camera position
     * @param type The view to change to
     */
    public changeView(type: ViewType) {
        switch (type) {
            case ViewType.WHOLE_BOARD_A:
                this.targetCameraPos = new Vector3(0,600,220);
                this.targetCameraRot = new Quaternion().setFromEuler(new Euler(-Math.PI * 0.4, 0, 0));
                break;
            case ViewType.WHOLE_BOARD_B:
                this.targetCameraPos = new Vector3(0,600,-220);
                this.targetCameraRot = new Quaternion().setFromEuler(new Euler(-Math.PI * 0.6, 0, Math.PI));
                break;
            case ViewType.FIELDS_A:
                this.targetCameraPos = new Vector3(0,370, 40);
                this.targetCameraRot = new Quaternion().setFromEuler(new Euler(-Math.PI * 0.5, 0, 0));
                break;
            case ViewType.FIELDS_B:
                this.targetCameraPos = new Vector3(0,370, -40);
                this.targetCameraRot = new Quaternion().setFromEuler(new Euler(-Math.PI * 0.5, 0, Math.PI));
                break;
        }
    }

    getMySide(){ return this.game.mySide; }

    /**
     * Sends an event to the server
     * @param event The event to send
     */
    sendEvent(event:Event<any>){
        return this.game.requestEvent(event);
    }

    //Deconstructs the game, removing it from the scene and removing all draw callbacks
    release(){
        this.releaseDrawCallback();
        this.releaseDebugDraw();
        this.scene.removeFromParent();
    }
}
