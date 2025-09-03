import  VisualGame from "./VisualGame.js";
import {sideTernary} from "../consts.js";
import {button, buttonId, registerDrawCallback} from "./ui.js";
import {StartRequestEvent} from "../networking/Events.js";

export abstract class VisualGameState{
    abstract visualTick(game: VisualGame):void;
    swapAway(game:VisualGame){}
}
export class VBeforeGameState extends VisualGameState{
    visualTick(game: VisualGame) {
        if(sideTernary(game.getGame().side, game.fieldsA, game.fieldsB).some(v=>v.getCard()!==undefined)){
            for(const field of sideTernary(game.getGame().side, game.fieldsA, game.fieldsB))
                field.enabled=false;
            sideTernary(game.getGame().side, game.handA, game.handB).enabled=false;
            game.state = new VChoosingStartState(game);
            //draw overlay
        }
    }
}
export class VChoosingStartState extends VisualGameState{
    private readonly removeDraw;
    private readonly game;
    private picked=false;
    private timer=0;
    private readonly buttonIds:[number,number,number]=[buttonId(), buttonId(), buttonId()];
    private flipping=false;
    constructor(game:VisualGame) {
        super();
        this.game=game;
        this.removeDraw = registerDrawCallback(0, (p5, scale) => {
            if(this.flipping){
                return;
            }

            p5.background(30,30,30,150);
            if(!this.picked) {
                button(p5, p5.width / 2 - scale * 0.5, p5.height / 2 - scale * 0.8, scale, scale * 0.5, "Go First", () => {
                    this.game.sendEvent(new StartRequestEvent({
                        which: "first",
                    }));
                    this.picked = true;
                }, scale, this.buttonIds[0]);
                button(p5, p5.width / 2 - scale * 0.5, p5.height / 2 - scale * 0.25, scale, scale * 0.5, "Go Second", () => {
                    this.game.sendEvent(new StartRequestEvent({
                        which: "second",
                    }));
                    this.picked = true;
                }, scale, this.buttonIds[1]);
                button(p5, p5.width / 2 - scale * 0.5, p5.height / 2 + scale * 0.3, scale, scale * 0.5, "No Preference", () => {
                    this.game.sendEvent(new StartRequestEvent({
                        which: "nopref",
                    }));
                    this.picked = true;
                }, scale, this.buttonIds[2]);
            }else{
                p5.textAlign(p5.CENTER,p5.CENTER);
                p5.textSize(scale/3);
                p5.text("Waiting"+".".repeat(this.timer), p5.width/2,p5.height/2);

                this.timer+=0.02;
                if(this.timer>=4) this.timer=0;
            }
        });
    }
    visualTick(game: VisualGame) {

    }
    swapAway(game: VisualGame) {
        super.swapAway(game);
        this.removeDraw();
    }

    flipCoin(){
        this.flipping=true;
    }
}

export class VTurnState extends VisualGameState{
    visualTick(game: VisualGame): void {

    }

}
