import {SidedPositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import type VisualGame from "./VisualGame.js";
import type {Side} from "../GameElement.js";
import {Group, Mesh, Quaternion, Vector3} from "three";
import type {SmartGameElement} from "./VisualGameElement.js";
import {modelLoader} from "./clientConsts.js";
import {externalPromise} from "../consts.js";
import {TurnState} from "../GameStates.js";

const actionCounterModel = (() => {
    let promise = externalPromise<Mesh>();

    modelLoader.load("/assets/actionbar.glb", model => {
        const toReturn = (model.scene.children[0] as Mesh).clone();
        toReturn.scale.set(30,30,30);
        toReturn.rotation.set(0,Math.PI,0);
        promise.resolve(toReturn);
    });

    return promise;
})();

export class ActionCounter extends SidedPositionedVisualGameElement implements SmartGameElement{
    private group=new Group();
    constructor(game:VisualGame, side:Side, position:Vector3, rotation:Quaternion=new Quaternion()) {
        super(game, side, position, rotation);

        game.scene.add(this.group);
        actionCounterModel.then(model=> {
            this.group.add(model.clone());
        });

        this.game=game;
    }
    public readonly game:VisualGame;

    tick(){
        const state = this.game.getGame().state;
        const thisActions = !(state instanceof TurnState) ? 0 :
            (state.turn === this.getSide() ? state.actionsLeft : 0);

        this.group.position.copy(this.position);
        this.group.quaternion.copy(this.rotation);

        const influences = (this.group.children[0] as Mesh).morphTargetInfluences!;
        for(let i=0;i<3;i++){
            if(thisActions+i<=1) influences[i]=1;
            else if(thisActions+i<=2) influences[i]=influences[i]!*0.7+0.3;
            else influences[i]=0;
        }
    }
    removeFromScene() {
        super.removeFromScene();
        this.group.removeFromParent();
    }
}
