import VisualGame from "./VisualGame.js";
import {Quaternion, Raycaster, type Scene, Vector3} from "three";
import type {VisualGameElement} from "./VisualGameElement.js";
import Card from "../Card.js";


export default class ElementScene{
    public readonly elements: VisualGameElement[] = [];
    public readonly scene: Scene;
    public cursorPos = new Vector3();
    public readonly raycaster = new Raycaster();

    protected previewCard:Card|undefined;
    protected drawPreviewCard=false;

    protected targetCameraPos = new Vector3();
    protected targetCameraRot = new Quaternion();

    constructor(scene:Scene) {
        this.scene=scene;
    }
}