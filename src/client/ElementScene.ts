import {Raycaster, type Scene, Vector3} from "three";
import type {VisualGameElement} from "./VisualGameElement.js";
import Card from "../Card.js";
import {updateOrder} from "./clientConsts.js";


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
            return (updateOrder[e2.constructor.name] || 999999) - (updateOrder[e1.constructor.name] || 999999);
        });

        return element;
    }
}