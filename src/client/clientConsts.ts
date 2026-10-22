import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PerspectiveCamera, Scene, TextureLoader, WebGLRenderer} from "three";
import dev from "../dev.js";
import {Event, type SerializableEventData} from "../networking/Events.js";

export const modelLoader = new GLTFLoader();

export const textureLoader = new TextureLoader();

// Init camera
let aspect = window.innerWidth / window.innerHeight;
export const camera = new PerspectiveCamera(50, aspect, 1, 10000);

export const threeScene = new Scene();

// Init renderer
export const renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true,
    premultipliedAlpha: false,
    alpha: true,
});
//Resizes the canvas to the window bounds
function windowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;

    //taken from https://discourse.threejs.org/t/keeping-an-object-scaled-based-on-the-bounds-of-the-canvas-really-battling-to-explain-this-one/17574/10
    //i was ripping my HAIR out
    const fov = 50;
    const planeAspectRatio = 4/3;
    if (camera.aspect > planeAspectRatio) {
        camera.fov = fov;
    } else {
        const cameraHeight = Math.tan((fov / 2)/360*2*Math.PI);
        const ratio = camera.aspect / planeAspectRatio;
        const newCameraHeight = cameraHeight / ratio;
        camera.fov = (Math.atan(newCameraHeight))/2/Math.PI*360  * 2;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
renderer.setPixelRatio(window.devicePixelRatio);
windowResize();
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", windowResize);

//--

let clickedListeners:{[priority:number]:Array<()=>boolean>}={};
let dragListeners:((v:{type:"start"|"move"|"end",x:number,y:number})=>void)[]=[];
let wheelListeners:((dy:number,dx:number)=>void)[]=[];
let dragging=false;
window.addEventListener("mousedown", (e:MouseEvent)=>{
    for(const listener of dragListeners) listener({type:"start",x:e.x,y:e.y});
    dragging=true;
});
window.addEventListener("mouseup", (e:MouseEvent)=>{
    for(const listener of Object.entries(clickedListeners).sort((a,b)=>
        parseInt(a[0])-parseInt(b[0])).map(v=>v[1]).flat()) if(listener()) break;
    for(const listener of dragListeners) listener({type:"end",x:e.x,y:e.y});
    dragging=false;
});
window.addEventListener("keyup", (e:KeyboardEvent)=>{
    if(e.key === "Enter")
        for(const listener of Object.entries(clickedListeners).sort((a,b)=>
            parseInt(a[0])-parseInt(b[0])).map(v=>v[1]).flat()) if(listener()) break;
});
window.addEventListener("mousemove", (e:MouseEvent)=>{
    if(dragging) for(const listener of dragListeners) listener({type:"move",x:e.x,y:e.y});
});
window.addEventListener("wheel", (e:WheelEvent)=>{
    for(const listener of wheelListeners) listener(e.deltaY,e.deltaX);
})

//@param listener The function that will run every time the mouse is clicked
//@param priority The higher the priority, the firster itll be checked (defaults to 0)
//@return The id of this listener
export function clickListener(listener:()=>boolean, priority=0){
    clickedListeners[priority] = clickedListeners[priority] ?? [];
    clickedListeners[priority].push(listener);
    return ()=>{
        clickedListeners[priority]!.splice(clickedListeners[priority]!.indexOf(listener),1);
    };
}

export function dragListener(listener:(v:{type:"start"|"move"|"end",x:number,y:number})=>void){
    return dragListeners.push(listener)-1;
}
export function removeDragListener(index:number){
    dragListeners.splice(index,1);
}

export function wheelListener(listener:(dy:number,dx:number)=>boolean){
    return wheelListeners.push(listener)-1;
}
export function removeWheelListener(index:number){
    wheelListeners.splice(index,1);
}

export const updateOrder: {[k:string]:number}={};
export const websocket = new WebSocket("ws://" + window.location.host);
export const websocketReady = new Promise(r => websocket.addEventListener("open", r));

export const eventReplyIds: { [k: string]: Replyable<any> } = {}
export class Replyable<T extends SerializableEventData> {
    public _callback?: (event: Event<any>) => void;
    private readonly source: Event<T>;

    constructor(source: Event<T>) {
        this.source = source;
    }

    onReply(callback: (event: Event<any>) => void) {
        if (this._callback !== undefined) {
            console.trace("tried to 2 event reply callbacks");
            return;
        }

        eventReplyIds![this.source.id] = this;
        this._callback = callback;
        return this.source;
    }
}

export function sendToServer(event:Event<any>){
    websocketReady.then(()=>{
        websocket.send(event.serialize());
        if(true) log("sent "+event.serialize())
    });
    return new Replyable(event);
}

//@ts-expect-error
window.showNetworkLogs=
    dev.on;
export function log(...data: any){
    //@ts-expect-error
    if(window.showNetworkLogs)
        if(typeof data === "string") console.log(data);
        else console.log(...data);
}