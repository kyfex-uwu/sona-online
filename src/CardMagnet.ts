import {Vector3} from "three";
import type Card from "./Card.js";

export default class CardMagnet{
    public readonly position: Vector3;
    public readonly positionRange: Vector3;
    public readonly rotation: Vector3;
    public readonly rotationRange: Vector3;
    public readonly radius: number;
    public readonly hardRadius: number;
    private readonly onPlace: (placed:Card) => void;

    constructor(position: Vector3, props:{
        radius?:number,
        hardRadius?:number,
        onPlace?: (v:Card) => void,
        positionRange?: Vector3,
        rotation?: Vector3,
        rotationRange?: Vector3,
    }={}) {
        props = Object.assign({
            radius:70,
            hardRadius:40,
            onPlace:()=>{},
            positionRange: new Vector3(),
            rotation: new Vector3(),
            rotationRange: new Vector3(),
        }, props);
        this.position = position;
        this.positionRange = props.positionRange!;
        this.rotation = props.rotation!;
        this.rotationRange = props.rotationRange!;
        this.radius = props.radius!;
        this.hardRadius = props.hardRadius!;
        this.onPlace = props.onPlace!;
    }

    applyCardOffset(card: Card){
        const dist = card.position.distanceTo(this.position);
        if(dist>this.radius) return;
        if(dist<this.hardRadius){
            card.position.copy(this.position);
            return;
        }

        card.position.lerp(this.position,(this.radius-dist)/this.radius);
    }
}
