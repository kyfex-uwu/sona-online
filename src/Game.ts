import Card, {type CardTemplate} from "./Card.js";
import type {GameElement} from "./GameElement.js";
import {Euler, Mesh, PlaneGeometry, Quaternion, Raycaster, type Scene, Vector2, Vector3} from "three";
import {camera, shuffled, updateOrder} from "./consts.js";
import FieldMagnet from "./magnets/FieldMagnet.js";
import RunawayMagnet from "./magnets/RunawayMagnet.js";
import DeckMagnet from "./magnets/DeckMagnet.js";

const raycaster = new Raycaster();
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

export default class Game{

    public selectedCard:Card|undefined;
    private readonly elements:GameElement[] = [];
    private readonly scene:Scene;
    public cursorPos:Vector3 = new Vector3();

    private readonly yourFields:[FieldMagnet,FieldMagnet,FieldMagnet] =
        [{} as FieldMagnet,{} as FieldMagnet,{} as FieldMagnet];
    private readonly yourRunaway:RunawayMagnet;
    private readonly yourDeck:DeckMagnet;
    private readonly theirFields:[FieldMagnet,FieldMagnet,FieldMagnet] =
        [{} as FieldMagnet,{} as FieldMagnet,{} as FieldMagnet];
    private readonly theirRunaway:RunawayMagnet;
    private readonly theirDeck:DeckMagnet;

    public constructor(scene:Scene) {
        this.scene=scene;

        this.yourFields[0] = this.addElement(new FieldMagnet(new Vector3(100,0,70)));
        this.yourFields[1] = this.addElement(new FieldMagnet(new Vector3(0,0,70)));
        this.yourFields[2] = this.addElement(new FieldMagnet(new Vector3(-100,0,70)));
        this.yourRunaway = this.addElement(new RunawayMagnet(new Vector3(-200,0,200)));
        this.yourDeck = this.addElement(new DeckMagnet(new Vector3(200,0,200)));

        this.theirFields[0] = this.addElement(new FieldMagnet(new Vector3(100,0,-70), {
            rotation: new Quaternion().setFromEuler(new Euler(0,Math.PI,0)),
            enabled:false,
        }));
        this.theirFields[1] = this.addElement(new FieldMagnet(new Vector3(0,0,-70), {
            rotation: new Quaternion().setFromEuler(new Euler(0,Math.PI,0)),
            enabled:false,
        }));
        this.theirFields[2] = this.addElement(new FieldMagnet(new Vector3(-100,0,-70), {
            rotation: new Quaternion().setFromEuler(new Euler(0,Math.PI,0)),
            enabled:false,
        }));
        this.theirRunaway = this.addElement(new RunawayMagnet(new Vector3(200,0,-200), {
            rotation: new Quaternion().setFromEuler(new Euler(0,Math.PI,0)),
            enabled:false,
        }));
        this.theirDeck = this.addElement(new DeckMagnet(new Vector3(-200,0,-200), {
            rotation: new Quaternion().setFromEuler(new Euler(0,Math.PI,0)),
            enabled:false,
        }));

        //crisis markers
    }

    public addElement<T extends GameElement>(element:T):T{
        element.addToScene(this.scene, this);
        this.elements.push(element);

        this.elements.sort((e1,e2) => {
            return (updateOrder[e2.constructor.name]||999999) - (updateOrder[e1.constructor.name]||999999);
        });

        return element;
    }

    public tick(){
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects([geo]);
        if (intersects[0] !== undefined) {
            this.cursorPos = intersects[0].point;
        }

        for(const element of this.elements) element.tick(this);
    }
    public visualTick(){
        for(const element of this.elements) element.visualTick(this);
    }

    public changeView(type:ViewType){
        switch(type){
            case ViewType.WHOLE_BOARD:
                camera.position.copy(new Vector3(0,600,220));
                camera.rotation.copy(new Euler(-Math.PI*0.4,0,0));
                break;
            case ViewType.FIELDS:
                camera.position.copy(new Vector3(0,450,20));
                camera.rotation.copy(new Euler(-Math.PI*0.5,0,0));
                break;
        }
    }

    startGame(yourDeck:CardTemplate[], theirDeck:CardTemplate[]){
        for(const field of this.yourFields) field.removeCard(this);
        for(const field of this.theirFields) field.removeCard(this);
        while(this.yourDeck.removeCard(this)){}
        while(this.theirDeck.removeCard(this)){}
        while(this.yourRunaway.removeCard(this)){}
        while(this.theirRunaway.removeCard(this)){}

        //shuffle animation?
        for(const template of shuffled(yourDeck)){
            this.yourDeck.addCard(this, this.addElement(template(this.yourDeck.position.clone(), this.yourDeck.rotation.clone())));
        }
        for(const template of shuffled(theirDeck)){
            this.theirDeck.addCard(this, this.addElement(template(this.theirDeck.position.clone(), this.theirDeck.rotation.clone())));
        }
    }
}
