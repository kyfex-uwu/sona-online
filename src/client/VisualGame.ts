import {Euler, Mesh, PlaneGeometry, Quaternion, Raycaster, type Scene, Vector2, Vector3} from "three";
import FieldMagnet from "./magnets/FieldMagnet.js";
import RunawayMagnet from "./magnets/RunawayMagnet.js";
import DeckMagnet from "./magnets/DeckMagnet.js";
import HandFan from "./fans/HandFan.js";
import VisualHandFan from "./fans/HandFan.js";
import Game from "../Game.js";
import type VisualCard from "./VisualCard.js";
import type {VisualGameElement} from "./VisualGameElement.js";
import {Side} from "../GameElement.js";
import {updateOrder} from "../consts.js";
import {camera} from "./clientConsts.js";
import {Event, FindGameEvent} from "../networking/Events.js";

const pointer = new Vector2();

window.addEventListener("pointermove", ( event: { clientX: number; clientY: number; } )=> {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
})
const geo = new Mesh(new PlaneGeometry(999999,999999).rotateX(-Math.PI/2));

export enum ViewType{
    WHOLE_BOARD,
    FIELDS,
}
export enum CurrentTurn{
    YOURS,
    THEIRS,
    NEITHER,
}

export default class VisualGame {
    private readonly game: Game;
    public selectedCard: VisualCard | undefined;
    public readonly elements: VisualGameElement[] = [];
    private readonly scene: Scene;
    public cursorPos = new Vector3();
    public readonly raycaster = new Raycaster();

    public readonly yourFields: [FieldMagnet, FieldMagnet, FieldMagnet] =
        [{} as FieldMagnet, {} as FieldMagnet, {} as FieldMagnet];
    public readonly yourRunaway: RunawayMagnet;
    public readonly yourDeck: DeckMagnet;
    public readonly yourHand: VisualHandFan;
    public readonly theirFields: [FieldMagnet, FieldMagnet, FieldMagnet] =
        [{} as FieldMagnet, {} as FieldMagnet, {} as FieldMagnet];
    public readonly theirRunaway: RunawayMagnet;
    public readonly theirDeck: DeckMagnet;
    public readonly theirHand: VisualHandFan;

    public currentTurn: CurrentTurn = CurrentTurn.NEITHER;
    public actionsLeft = 0;
    public processingAction = false;

    public constructor(scene: Scene) {
        this.scene = scene;
        this.game = new Game();

        this.yourFields[0] = this.addElement(new FieldMagnet(new Vector3(100, 0, 70), Side.YOU));
        this.yourFields[1] = this.addElement(new FieldMagnet(new Vector3(0, 0, 70), Side.YOU));
        this.yourFields[2] = this.addElement(new FieldMagnet(new Vector3(-100, 0, 70), Side.YOU));
        this.yourRunaway = this.addElement(new RunawayMagnet(new Vector3(-200, 0, 200), Side.YOU));
        this.yourDeck = this.addElement(new DeckMagnet(new Vector3(200, 0, 200), Side.YOU));
        this.yourHand = this.addElement(new HandFan(new Vector3(0, 0, 200), Side.YOU));

        this.theirFields[0] = this.addElement(new FieldMagnet(new Vector3(100, 0, -70), Side.THEM, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
            enabled: false,
        }));
        this.theirFields[1] = this.addElement(new FieldMagnet(new Vector3(0, 0, -70), Side.THEM, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
            enabled: false,
        }));
        this.theirFields[2] = this.addElement(new FieldMagnet(new Vector3(-100, 0, -70), Side.THEM, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
            enabled: false,
        }));
        this.theirRunaway = this.addElement(new RunawayMagnet(new Vector3(200, 0, -200), Side.THEM, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
            enabled: false,
        }));
        this.theirDeck = this.addElement(new DeckMagnet(new Vector3(-200, 0, -200), Side.THEM, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
            enabled: false,
        }));
        this.theirHand = this.addElement(new HandFan(new Vector3(0, 0, -200), Side.YOU, {
            rotation: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)),
        }));

        //crisis markers
    }

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

        for (const element of this.elements) element.tick(this);
    }

    public visualTick() {
        for (const element of this.elements) element.visualTick(this);
    }

    public changeView(type: ViewType) {
        switch (type) {
            case ViewType.WHOLE_BOARD:
                camera.position.copy(new Vector3(0, 600, 220));
                camera.rotation.copy(new Euler(-Math.PI * 0.4, 0, 0));
                break;
            case ViewType.FIELDS:
                camera.position.copy(new Vector3(0, 450, 20));
                camera.rotation.copy(new Euler(-Math.PI * 0.5, 0, 0));
                break;
        }
    }

    requestStart() {
        for (const field of this.yourFields) field.removeCard(this);
        for (const field of this.theirFields) field.removeCard(this);
        while (this.yourDeck.removeCard(this)) {
        }
        while (this.theirDeck.removeCard(this)) {
        }
        while (this.yourRunaway.removeCard(this)) {
        }
        while (this.theirRunaway.removeCard(this)) {
        }

        this.currentTurn = CurrentTurn.NEITHER;
        this.actionsLeft = 0;

        this.sendEvent(new FindGameEvent({}));
    }
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
}
