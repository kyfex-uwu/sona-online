export abstract class Scene{
    abstract exit():void;
    abstract tick():void;
}
export const startTime = new Date().valueOf();
