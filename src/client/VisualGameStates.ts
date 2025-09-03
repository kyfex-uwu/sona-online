import  VisualGame from "./VisualGame.js";
import {sideTernary} from "../consts.js";
import {BeforeGameState} from "../GameStates.js";

interface VisualGameState{
    visualTick(game: VisualGame):void;
}
class VisualBeforeGameState extends BeforeGameState implements VisualGameState{
    visualTick(game: VisualGame) {
        if(sideTernary(game.getGame().side, game.fieldsA, game.fieldsB).some(v=>v.getCard()!==undefined)){
            for(const field of sideTernary(game.getGame().side, game.fieldsA, game.fieldsB))
                field.enabled=false;
        }
    }
}
