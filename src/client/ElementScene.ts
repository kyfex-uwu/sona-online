import {Raycaster, type Scene, Vector3} from "three";
import type {VisualGameElement} from "./VisualGameElement.js";
import Card from "../Card.js";
import {updateOrder} from "./clientConsts.js";
import type SuperficialVisualCard from "./SuperficialVisualCard.js";


export default class ElementScene{
    public readonly elements: VisualGameElement[] = [];
    public readonly scene: Scene;
    public cursorPos = new Vector3();
    public readonly raycaster = new Raycaster();

    protected previewCard:Card|undefined;
    protected drawPreviewCard=false;

    constructor(scene:Scene) {
        this.scene=scene;
    }

    //Visually ticks all the game elements and the camera
    public visualTick() {
        for (const element of this.elements) element.visualTick();
    }

    /**
     * Adds the element to this game
     * @param element The element to add
     */
    public addElement<T extends VisualGameElement>(element: T): T {
        this.elements.push(element);

        this.elements.sort((e1, e2) => {
            return (updateOrder[e2.constructor.name] || Infinity) - (updateOrder[e1.constructor.name] || Infinity);
        });

        return element;
    }

    public raycastCards(cards:SuperficialVisualCard[]){
        const intersects = this.raycaster.intersectObjects(cards
            .map(card=>card.flipGroup.children[0]?.children)
            .flat().filter(model=>model!==undefined)
            .filter(model=>model.name === "Plane001"), false);
        if(intersects[0]!==undefined)
            return intersects[0].object.parent?.parent?.parent?.userData.card as SuperficialVisualCard;

        /*
        const intersects = this.elScene.raycaster.intersectObjects(this.cards
                .map(card => card.model).filter(model => model !== undefined)
                .concat(...(this.cards.length !== 0 ? [] : [this.fakeCard as Group])));
            if (intersects[0] !== undefined) {
                //card is undefined!
                this.onSelect(((intersects[0].object.parent!.parent!.parent! as Group).userData.card as VisualCard), this.game);
            }
            return false;
         */
    }
}