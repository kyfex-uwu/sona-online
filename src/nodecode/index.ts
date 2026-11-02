function o<T>(v:T){return v}

type ValTypeSingle = "number"|"boolean"|"card";
type ValTypeSingleActual<T extends ValTypeSingle> =
    T extends "number" ? number :
        T extends "boolean" ? boolean :
            T extends "card" ? undefined :
                never;
type ValType = `${ValTypeSingle}${"?"|""}${"[]"|""}`
type Typeof<T extends ValType> = T extends `${any}[]` ? (
    T extends `${infer R extends ValTypeSingle}?[]` ? Array<ValTypeSingleActual<R>|undefined> :
        T extends `${infer R extends ValTypeSingle}[]` ? Array<ValTypeSingleActual<R>> : never
    ) : (
    T extends `${infer R extends ValTypeSingle}?` ? ValTypeSingleActual<R>|undefined :
        T extends `${infer R extends ValTypeSingle}` ? ValTypeSingleActual<R> : never
    );

type Connection<T extends ValType, K extends string=string> =
    {node:CodeNode<any, {[k2 in K]:T}>, outKey:K}

class CodeNode<Inputs extends {[k:string]:ValType}, Outputs extends {[k:string]:ValType}>{
    public readonly inputs: {[k in keyof Inputs]:{type:Inputs[k], connection:undefined|Connection<Inputs[k]>}};
    public readonly outputs;
    private readonly callFunc;
    constructor(inputs:Inputs,outputs:Outputs, callFunc:(inputs:{[k in keyof Inputs]: ()=>Typeof<Inputs[k]>})=>
        {[k in keyof Outputs]: Typeof<Outputs[k]>}){
        this.inputs = ({} as unknown as undefined)!;
        for(const key in inputs){
            this.inputs[key] = {type:inputs[key], connection:undefined};
        }
        this.outputs=outputs;
        this.callFunc=callFunc;
    }
    call(){
        const param:{[k in keyof Inputs]: ()=>Typeof<Inputs[k]>} = ({} as unknown as undefined)!;
        for(const key in this.inputs){
            const connection = this.inputs[key].connection;
            if(connection === undefined)
                throw new Error("Disconnected input "+key);
            param[key] = ()=>connection.node.call()[connection.outKey]!;
        }
        return this.callFunc(param);
    }
    connect<I extends keyof Inputs, K extends string=string>(node:CodeNode<any, {[k in K]:Inputs[I]}>, outKey:K, input:I){
        this.inputs[input].connection = {node,outKey};
        return this;
    }
    disconnect(input:keyof Inputs){
        this.inputs[input].connection = undefined;
        return this;
    }
}

// const supplier1 = new CodeNode({},{result:"number"},()=>o({result:1}));
// const supplier2 = new CodeNode({},{result:"number"},()=>o({result:2}));
// const add = new CodeNode({a:"number",b:"number"},{result:"number"},
//                         ({a,b})=>o({result:a()+b()}))
//     .connect(supplier1, "result", "a")
//     .connect(supplier2, "result", "b");

// add.call();

const canvas:HTMLCanvasElement = undefined!;
const ctx = canvas.getContext("2d")!;
const camera = {
    x:0,
    y:0,
    scale:1,
};
const mouse = {
    x:0,
    y:0
}
canvas.addEventListener("mousemove", e=>{
    mouse.x=e.offsetX;
    mouse.y=e.offsetY;
});
canvas.addEventListener("mouseup", e=>{
    const transformedPos = [e.offsetX/camera.scale+camera.x, e.offsetY*camera.scale+camera.y] satisfies [number,number];
    for(const element of elements)
        if(element.mouseUp(transformedPos[0]-element.x, transformedPos[1]-element.y)) return;
});
canvas.addEventListener("mousedown", e=>{
    const transformedPos = [e.offsetX/camera.scale+camera.x, e.offsetY*camera.scale+camera.y] satisfies [number,number];
    for(const element of elements)
        if(element.mouseDown(transformedPos[0]-element.x, transformedPos[1]-element.y)) return;
});
const elements:NElement[]=[];

abstract class NElement{
    public x;
    public y;
    constructor(x:number,y:number){
        this.x=x;
        this.y=y;
    }

    render(){}
    cursor(x:number, y:number):string|void{}
    mouseDown(x:number, y:number){ return false; }
    mouseUp(x:number, y:number){ return false; }
}

function camelToReadable(str:string){
    return str.match(/([A-Z]|^)[^A-Z]*/g)?.map(v=>v.slice(0,1).toUpperCase()+v.slice(1)).join(" ") ?? str;
}
class CodeNodeHolder extends NElement{
    public node;
    constructor(x:number, y:number, node:CodeNode<any,any>){
        super(x,y);
        this.node=node;
    }
    render(){
        //already translated and scaled
        //rect(0,0,100,50+Math.max(Object.keys(this.node.inputs).length, Object.keys(this.node.outputs).length)*20)
    }
    cursor(x:number, y:number){
        if(x>0 && x<100 && y>0 && y < 20) return "grab";
        return;
    }
    mouseDown(x:number, y:number){
        return x>0 && x<100 && y>0 && y < 20;
    }
    mouseUp(x:number, y:number){
        return false;
    }
}

function render(){
    ctx.resetTransform();
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.strokeStyle = "#ccdddd";
    ctx.lineWidth = camera.scale*2;
    for(let x=camera.x*camera.scale;x<window.innerWidth;x+=30*camera.scale){
        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x,window.innerHeight);
        ctx.stroke();
    }
    for(let y=camera.y*camera.scale;y<window.innerHeight;y+=30*camera.scale){
        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(window.innerWidth, 0);
        ctx.stroke();
    }

    let cursor=undefined;
    for(const element of elements){
        ctx.save();
        ctx.translate(element.x-camera.x, element.y-camera.y);
        ctx.scale(camera.scale, camera.scale);
        element.render();
        ctx.restore();

        cursor = cursor ?? element.cursor(mouse.x*camera.scale+camera.x, mouse.y*camera.scale+camera.y);
    }
    canvas.style.cursor = cursor ?? "default";

    requestAnimationFrame(render);
}
render();