import {SidedPositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import type VisualGame from "./VisualGame.js";
import type {Side} from "../GameElement.js";
import {Euler, Group, Mesh, Quaternion, Vector3} from "three";
import type {SmartGameElement} from "./VisualGameElement.js";
import {modelLoader} from "./clientConsts.js";
import {externalPromise} from "../consts.js";
import {lerp} from "./ui.js";

const counterModel = (() => {
    let promise = externalPromise<Mesh>();

    modelLoader.load("/assets/counter.glb", model => {
        const toReturn = (model.scene.children[0] as Mesh).clone();
        toReturn.scale.set(15,15,15);
        promise.resolve(toReturn);
    });

    return promise;
})();

const brokenAngle = new Quaternion().setFromEuler(new Euler(0,-Math.PI/2,0));
const heartAngle = new Quaternion().setFromEuler(new Euler(0,Math.PI/2,-Math.PI));
export class CrisisCounter extends SidedPositionedVisualGameElement implements SmartGameElement{
    private group=new Group();
    private counters:[Group|undefined,Group|undefined,Group|undefined] = [undefined,undefined,undefined];
    constructor(game:VisualGame, side:Side, position:Vector3, rotation:Quaternion=new Quaternion()) {
        super(game, side, position, rotation);

        game.scene.add(this.group);
        counterModel.then(model=> {
            const offs = [
                new Vector3(0,0,-1),
                new Vector3(-Math.sqrt(3)/2,0,0.5),
                new Vector3(Math.sqrt(3)/2,0,0.5),
            ];
            for (let i=0;i<offs.length;i++) {
                const thisM = new Group().add(new Group().add(model.clone()));
                thisM.position.add(offs[i]!.multiplyScalar(25));
                this.counters[i]=thisM;
                this.group.add(thisM);
            }
        });

        this.game=game;
    }
    public readonly game:VisualGame;

    tick(){
        const crisisCount = this.game.getGame().getCrisis(this.getSide());

        this.group.position.copy(this.position);
        this.group.quaternion.copy(this.rotation);

        for(let i=0;i<3;i++) {
            this.counters[i]?.children[0]!.children[0]!.quaternion.slerp(
                crisisCount <= i ? heartAngle : brokenAngle, 0.1);
            this.counters[i]?.children[0]!.position.set(0,
                lerp(0,40,(2*Math.abs(this.counters[i]!.children[0]!.children[0]!.quaternion.angleTo(heartAngle))/Math.PI-1)**2),
                0);
        }
    }
    removeFromScene() {
        super.removeFromScene();
        this.group.removeFromParent();
    }
}
