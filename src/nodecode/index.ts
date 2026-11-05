
function o<T>(v:T){return v}

type ValTypeSingle = "number"|"boolean"|"card"|"unknown";
type ValTypeSingleActual<T extends ValTypeSingle> =
    T extends "number" ? number :
        T extends "boolean" ? boolean :
            T extends "card" ? string :
                never;
type ValType = `${ValTypeSingle}${"?"|""}${"[]"|""}`
type Typeof<T extends ValType> = T extends ValType ? (
    T extends `${any}?${any}` ? (
        T extends `${any}?mutable${any}` ? (
            T extends `${infer R extends ValTypeSingle}?mutable[]` ? (
                (()=>ValTypeSingleActual<R>|undefined)[]
                ) : T extends `${infer R extends ValTypeSingle}?mutable` ? (
                (()=>ValTypeSingleActual<R>|undefined)
                ) : never
            ) : (
            T extends `${infer R extends ValTypeSingle}?[]` ? (
                (ValTypeSingleActual<R>|undefined)[]
                ) : T extends `${infer R extends ValTypeSingle}?` ? (
                (ValTypeSingleActual<R>|undefined)
                ) : never
            )
        ) : (
        T extends `${any}mutable${any}` ? (
            T extends `${infer R extends ValTypeSingle}mutable[]` ? (
                (()=>ValTypeSingleActual<R>)[]
                ) : T extends `${infer R extends ValTypeSingle}mutable` ? (
                (()=>ValTypeSingleActual<R>)
                ) : never
            ) : (
            T extends `${infer R extends ValTypeSingle}[]` ? (
                (ValTypeSingleActual<R>)[]
                ) : T extends `${infer R extends ValTypeSingle}` ? (
                (ValTypeSingleActual<R>)
                ) : never
            )
        )
    ) : never;

type Connection<T extends ValType, K extends string=string> =
    {node:CodeNode<any, {[k2 in K]:T}>, outKey:K}

class CodeNode<Inputs extends {[k:string]:ValType}={[k:string]:ValType}, Outputs extends {[k:string]:ValType}={[k:string]:ValType}>{
    public readonly inputs: {[k in keyof Inputs]:{type:Inputs[k], connection:undefined|Connection<Inputs[k]>}};
    public readonly outputs;
    private readonly callFunc;
    public nElement?:CodeNodeHolder;
    constructor(inputs:Inputs,outputs:Outputs, callFunc:(inputs:{[k in keyof Inputs]: (optRunId?:number)=>Typeof<Inputs[k]>}, runId:number)=>
        {[k in keyof Outputs]: Typeof<Outputs[k]>}){
        this.inputs = ({} as unknown as undefined)!;
        for(const key in inputs)
            this.inputs[key] = {type:inputs[key], connection:undefined};
        this.outputs=outputs;
        this.callFunc=callFunc;
    }
    call(runId=Math.random()){
        const param:{[k in keyof Inputs]: (optRunId?:number)=>Typeof<Inputs[k]>} = ({} as unknown as undefined)!;
        for(const key in this.inputs){
            const connection = this.inputs[key].connection;
            if(connection === undefined)
                throw new Error("Disconnected input "+key);

            param[key] = (optRunId)=>connection.node.call(optRunId ?? runId)[connection.outKey]!;
        }
        return this.callFunc(param, runId);
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

const nodes = {
    value:<T extends ValType>(type:T, value:Typeof<T>)=>new CodeNode({},{value:type},()=>o({value})),
    cast:<Old extends ValType, New extends ValType>(oldType:Old, newType:New)=>
        new CodeNode({value:oldType}, {result:newType}, ({value})=>o({result:value() as unknown as Typeof<New>})),

    ternary:(type:ValType)=>new CodeNode({trueValue:type, falseValue:type, boolean:"boolean"}, {result:type},
        ({trueValue,falseValue,boolean})=>o({result:boolean()?trueValue():falseValue()})),
    not:()=>new CodeNode({value:"boolean"},{result:"boolean"},({value})=>o({result:!value()})),

    math:(type:"add"|"subtract"|"multiply"|"divide")=>new CodeNode({a:"number",b:"number"},{result:"number"},
        ({
            add:({a,b})=>o({result:a()+b()}),
            subtract:({a,b})=>o({result:a()-b()}),
            multiply:({a,b})=>o({result:a()*b()}),
            divide:({a,b})=>o({result:a()/b()}),
        } satisfies {[k in typeof type]:(data:{a:()=>number, b:()=>number})=>{result:number}})[type]),
    compare:(type:"greater"|"less"|"greaterE"|"lessE")=>new CodeNode({a:"number",b:"number"},{result:"boolean"},
        ({
            greater:({a,b})=>o({result:a()>b()}),
            less:({a,b})=>o({result:a()<b()}),
            greaterE:({a,b})=>o({result:a()>=b()}),
            lessE:({a,b})=>o({result:a()<=b()}),
        } satisfies {[k in typeof type]:(data:{a:()=>number, b:()=>number})=>{result:boolean}})[type]),
    logic:(type:"and"|"or"|"xor")=>new CodeNode({a:"boolean",b:"boolean"},{result:"boolean"},
        ({
            and:({a,b})=>o({result:a()&&b()}),
            or:({a,b})=>o({result:a()||b()}),
            xor:({a,b})=>o({result:a()!==b()}),
        } satisfies {[k in typeof type]:(data:{a:()=>boolean, b:()=>boolean})=>{result:boolean}})[type]),

    random:()=>{
        let currentId=0;
        let currentRand=0;
        return new CodeNode({min:"number",max:"number",step:"number"},{result:"number"},
            ({min,max,step}, runId)=>{
                if(currentId!==runId){
                    currentId=runId;
                    currentRand=Math.random();
                }
                const [stepC, minC] = [step(), min()];
                return {result:Math.floor(currentRand*((max()-minC)/stepC))*stepC+minC};
            });
    },

    transformationStart:<T extends `${ValTypeSingle}${"?"|""}`>(type:T, itemGetter:()=>Typeof<T>)=>
        new CodeNode({},{item:type},()=>o({item:itemGetter()})),
    transformationEndMap:<Tf extends `${ValTypeSingle}${"?"|""}`, Og extends `${ValTypeSingle}${"?"|""}`>(origType:Og, tfType:Tf, setItem:(item:Typeof<Og>)=>void)=>
        new CodeNode({value:tfType, list:`${origType}[]`},{mappedList:`${tfType}[]`},({value, list})=>{
            const toReturn = new Array<Typeof<Tf>>();
            for(const val of list()){
                setItem(val as Typeof<Og>);
                toReturn.push(value(Math.random()))
            }
            return {mappedList:toReturn as unknown as Typeof<`${Tf}[]`>};
        }),
    transformationEndFilter:<T extends `${ValTypeSingle}${"?"|""}`>(origType:T, setItem:(item:Typeof<T>)=>void)=>
        new CodeNode({value:"boolean", list:`${origType}[]`},{filteredList:`${origType}[]`},({value, list})=>{
            const toReturn = new Array<Typeof<T>>();
            for(const val of list()){
                setItem(val as Typeof<T>);
                if(value(Math.random())) toReturn.push(val as Typeof<T>);
            }
            return {filteredList:toReturn as unknown as Typeof<`${T}[]`>};
        }),

    sortStart:<T extends `${ValTypeSingle}${"?"|""}`>(type:T, itemGetter:()=>{a:Typeof<T>,b:Typeof<T>})=>
        new CodeNode({},{a:type, b:type}, ()=>itemGetter()),
    sortEnd:<T extends `${ValTypeSingle}${"?"|""}`>(origType:T, setItem:(a:Typeof<T>,b:Typeof<T>)=>void)=>
        new CodeNode({value:"number", list:`${origType}[]`},{sortedList:`${origType}[]`},({value, list})=>{
            return {sortedList:list().toSorted((a,b)=>{
                    setItem(a as Typeof<T>, b as Typeof<T>);
                    return value(Math.random());
                }) as unknown as Typeof<`${T}[]`>};
        }),

    arrayLength:<T extends `${ValTypeSingle}${"?"|""}`>(type:T)=>
        new CodeNode({list:`${type}[]`},{length:"number"},({list})=>o({length:list().length})),
};
function createFilter<T extends `${ValTypeSingle}${"?"|""}`>(type:T){
    let ref:Typeof<T>;
    return {
        start:nodes.transformationStart(type,() => ref),
        end:nodes.transformationEndFilter(type, (v:Typeof<T>) => { ref=v; })
    };
}
function createMap<Og extends `${ValTypeSingle}${"?"|""}`, Tf extends `${ValTypeSingle}${"?"|""}`>(type:Og, mappedType:Tf){
    let ref:Typeof<Og>;
    return {
        start:nodes.transformationStart(type,() => ref),
        end:nodes.transformationEndMap(type, mappedType, (v:Typeof<Og>) => { ref=v; })
    };
}
function createSort<T extends `${ValTypeSingle}${"?"|""}`>(type:T){
    let ref:{a:Typeof<T>, b:Typeof<T>};
    return {
        start:nodes.sortStart(type,() => ref),
        end:nodes.sortEnd(type, (a:Typeof<T>, b:Typeof<T>) => { ref={a,b}; })
    };
}

// const {start:tfStart, end:tfEnd} = createSort("number");
// const supplierNumberArray = nodes.value("number[]",[4,8,23,5,5,8,6,4]);
// const add = nodes.math("subtract")
//     .connect(tfStart, "a", "a")
//     .connect(tfStart, "b", "b");
// tfEnd.connect(add, "result", "value")
//     .connect(supplierNumberArray, "value", "list");
// console.log(tfEnd.call().sortedList);

// const supplier1 = nodes.value("number",1);
// const supplier2 = nodes.value("number",2);
// const add2 = nodes.math("add")
//     .connect(supplier1, "value", "a")
//     .connect(supplier2, "value", "b");
// console.log(add2.call().result);

const canvas:HTMLCanvasElement = document.getElementById("canvas") as HTMLCanvasElement;
function changeSize(){
    canvas.width = window.innerWidth;
    canvas.height=window.innerHeight;
}
changeSize();
window.addEventListener("resize", changeSize);

const ctx = canvas.getContext("2d")!;
const camera = {
    x:window.innerWidth/-2,
    y:window.innerHeight/-2,
    scale:1,
};
const mouse = {
    rx:0,
    ry:0,
    rdx:0,
    rdy:0,

    get x(){ return (mouse.rx+camera.x)/camera.scale; },
    get y(){ return (mouse.ry+camera.y)/camera.scale; },
    get dx(){ return mouse.rdx/camera.scale; },
    get dy(){ return mouse.rdy/camera.scale; },

};
canvas.addEventListener("mousemove", e=>{
    mouse.rdx=mouse.rx-(mouse.rx=e.offsetX);
    mouse.rdy=mouse.ry-(mouse.ry=e.offsetY);
});
canvas.addEventListener("mouseup", e=>{
    root.mouseUp(e.offsetX/camera.scale+camera.x, e.offsetY*camera.scale+camera.y);
});
canvas.addEventListener("mousedown", e=>{
    root.mouseDown(e.offsetX/camera.scale+camera.x, e.offsetY*camera.scale+camera.y);
});
canvas.addEventListener("wheel", e=>{
    root.scroll(e.deltaY);
})
const elements:NElement[]=[];

abstract class NElement{
    public x;
    public y;
    public parentEl:NElement|undefined=undefined;
    public children:Set<NElement> = new Set();
    constructor(x:number,y:number){
        this.x=x;
        this.y=y;
    }

    render(){
        for(const child of this.children){
            ctx.save();
            ctx.translate(child.x, child.y);
            child.render();
            ctx.restore();
        }
    }
    cursor(x:number, y:number):string|void{
        for(const child of this.children){
            const maybeCursor = child.cursor(x-child.x, y-child.y);
            if(maybeCursor) return maybeCursor;
        }
    }
    mouseDown(x:number, y:number){
        for(const child of this.children){
            if(child.mouseDown(x-child.x, y-child.y)) return true;
        }
        return false;
    }
    mouseUp(x:number, y:number){
        for(const child of this.children){
            if(child.mouseUp(x-child.x, y-child.y)) return true;
        }
        return false;
    }
    scroll(dist:number){
        for(const child of this.children){
            if(child.scroll(dist)) return true;
        }
        return false;
    }

    parent(parent:NElement|undefined){
        this.parentEl?.children.delete(this);
        this.parentEl=parent;
        parent?.children.add(this);
    }
}

// class NodeWire extends NElement{
//     constructor(x:number,y:number, parent:CodeNodeHolder, key:{input:keyof}){
//         super(x,y);
//         this.parent(parent);
//     }
// }

function camelToReadable(str:string){
    return str.match(/([A-Z]|^)[^A-Z]*/g)?.map(v=>v.slice(0,1).toUpperCase()+v.slice(1)).join(" ") ?? str;
}
function distTo(x1:number,y1:number,x2:number,y2:number){
    return Math.sqrt((x1-x2)**2+(y1-y2)**2);
}

let codeNodeHolders:CodeNodeHolder[] = [];
class CodeNodeHolder extends NElement{
    public node;
    private name: string;
    private dragging: [number,number]|false=false;
    private connectData: ["input"|"output",string]|undefined;
    constructor(x:number, y:number, node:CodeNode<any,any>, name:string){
        super(x,y);
        this.node=node;
        this.node.nElement=this;
        this.name=name;
        codeNodeHolders.push(this);
    }
    render(){
        if(this.dragging){
            this.x=mouse.x-this.dragging[0];
            this.y=mouse.y-this.dragging[1];
        }

        const height = this.getHeight();
        ctx.beginPath();
        ctx.roundRect(0,0,
            100,height,
            8);
        ctx.fillStyle="#ddd";
        ctx.shadowBlur=15*camera.scale;
        ctx.shadowColor="#888";
        ctx.fill();

        ctx.fillStyle="#bbb";
        ctx.shadowBlur=0;
        ctx.beginPath();
        ctx.roundRect(0,0,100,25,[8,8,0,0]);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(0,0,
            100,height,
            8);
        ctx.strokeStyle="#666";
        ctx.lineWidth=1;
        ctx.stroke();

        ctx.fillStyle="#666";
        ctx.textAlign="center";
        ctx.font="18px sans-serif";
        ctx.fillText(this.name, 50,20);

        let y=40;
        ctx.font="15px sans-serif";
        ctx.textAlign="left";
        ctx.textBaseline="middle";
        for(const input in this.node.inputs){
            const port = this.node.inputs[input]!;
            ctx.beginPath();
            ctx.ellipse(0,y,5,5, 0, 0, 7);
            ctx.fillStyle="#f00";
            ctx.fill();
            ctx.fillStyle="#666";
            ctx.fillText(camelToReadable(input), 10, y);

            if(port.connection){
                const otherHeight = port.connection.node.nElement?.outputPort(port.connection.outKey)
                if(otherHeight!==undefined){
                    ctx.beginPath();
                    ctx.strokeStyle="#f00";
                    ctx.lineWidth=8;
                    ctx.moveTo(0,y);
                    ctx.lineTo(port.connection.node.nElement!.x-this.x+100,
                        port.connection.node.nElement!.y+otherHeight-this.y);
                    ctx.stroke();
                }
            }

            y+=20;
        }
        y=40;
        ctx.textAlign="right";
        for(const output in this.node.outputs){
            ctx.beginPath();
            ctx.ellipse(100,y,5,5, 0, 0, 7);
            ctx.fillStyle="#f00";
            ctx.fill();
            ctx.fillStyle="#666";
            ctx.fillText(camelToReadable(output), 90, y);
            y+=20;
        }

        if(this.connectData){
            ctx.beginPath();
            ctx.strokeStyle="#f00";
            ctx.lineWidth=8;
            let dest = this.getNearestPort()?.[2] ?? [mouse.x-this.x, mouse.y-this.y] satisfies [number,number];

            ctx.moveTo(dest[0],dest[1]);
            if(this.connectData[0] === "input"){
                ctx.lineTo(0, this.inputPort(this.connectData[1])??0);
            }else{
                ctx.lineTo(100, this.outputPort(this.connectData[1])??0);
            }
            ctx.stroke();
        }

        super.render();
    }
    cursor(x:number, y:number){
        if(x>0 && x<100 && y>0 && y < 25) return "grab";

        let yH=40;
        for(const input in this.node.inputs){
            distTo(x, y, 0, yH)
            if(distTo(x, y, 0, yH)<5) return "crosshair";
            yH+=20;
        }
        yH=40;
        for(const output in this.node.outputs){
            if(distTo(x, y, 100, yH)<5) return "crosshair";
            yH+=20;
        }

        return;
    }
    mouseDown(x:number, y:number){
        if(x>0 && x<100 && y>0 && y < 25) {
            this.dragging=[x,y];
            return true;
        }
        let yH=40;
        for(const input in this.node.inputs){
            if(distTo(x, y, 0, yH)<5) {
                this.connectData=["input", input];
                return true;
            }
            yH+=20;
        }
        yH=40;
        for(const output in this.node.outputs){
            if(distTo(x, y, 100, yH)<5) {
                this.connectData=["output", output];
                return true;
            }
            yH+=20;
        }
        return false;
    }
    mouseUp(x:number, y:number){
        const port = this.getNearestPort();
        if(port){
            if(this.connectData![0]==="input"){
                this.node.connect(port[0], port[1], this.connectData![1]);
            }else{
                port[0].connect(this.node, this.connectData![1], port[1]);
            }
        }

        this.dragging=false;
        this.connectData=undefined;
        return false;
    }

    inputPort(name:string){
        let y=40;
        for(const input in this.node.inputs){
            if(input === name) return y;
            y+=20;
        }
    }
    outputPort(name:string){
        let y=40;
        for(const output in this.node.outputs){
            if(output === name) return y;
            y+=20;
        }
    }
    getHeight(){
        return 40+Math.max(Object.keys(this.node.inputs).length, Object.keys(this.node.outputs).length)*20;
    }
    getNearestPort():[CodeNode,string, [number,number]]|undefined{
        if(!this.connectData) return undefined;
        for(const holder of codeNodeHolders){
            if(holder === this) continue;

            if(!(mouse.x>holder.x-10 && mouse.x<holder.x+110&&mouse.y>holder.y-10&&mouse.y<holder.y+holder.getHeight()+10))
                continue;

            if(this.connectData[0] === "input"){
                for(const output in holder.node.outputs){
                    if(distTo(mouse.x, mouse.y, holder.x+100, holder.y+holder.outputPort(output)!)<8){
                        return [holder.node, output, [holder.x-this.x+100, holder.y-this.y+holder.outputPort(output)!]];
                    }
                }
            }else{
                for(const input in holder.node.inputs){
                    if(distTo(mouse.x, mouse.y, holder.x, holder.y+holder.inputPort(input)!)<8){
                        return [holder.node, input, [holder.x-this.x, holder.y-this.y+holder.inputPort(input)!]];
                    }
                }
            }
        }
    }

    // switchNode(newNode:CodeNode){
    //     for(const input in this.node.inputs){
    //         if(this.node.inputs[input].connection === undefined) continue;
    //         if(newNode.inputs[input].type !== this.node.inputs[input].type) return false;
    //     }
    //
    //     return true;
    // }
}

const root = new (class extends NElement{
    constructor(){
        super(0,0);
    }

    render(){
        if(this.dragging){
            camera.x+=mouse.rdx;
            camera.y+=mouse.rdy;
        }
        mouse.rdx=0;
        mouse.rdy=0;

        ctx.resetTransform();
        ctx.fillStyle="#ffffff";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.strokeStyle = "#ccdddd";
        ctx.lineWidth = camera.scale*2;
        const size=30*camera.scale;
        for(let x=-camera.x%size;x<window.innerWidth;x+=size){
            ctx.beginPath();
            ctx.moveTo(x,0);
            ctx.lineTo(x,window.innerHeight);
            ctx.stroke();
        }
        for(let y=-camera.y%size;y<window.innerHeight;y+=size){
            ctx.beginPath();
            ctx.moveTo(0,y);
            ctx.lineTo(window.innerWidth, y);
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.scale(camera.scale, camera.scale);
        super.render();
        ctx.restore();
    }

    private dragging=false;
    mouseUp(x: number, y: number) {
        this.dragging=false;
        super.mouseUp(x, y);
        return true;
    }
    mouseDown(x: number, y: number) {
        if(super.mouseDown(x, y)) return true;
        this.dragging=true;
        return true;
    }
    scroll(dist: number): boolean {
        if(super.scroll(dist)) return true;
        const oldScale=camera.scale;
        camera.scale = Math.max(0.3,Math.min(10,camera.scale*2**(dist*0.001)));
        camera.x=(camera.x+mouse.rx)/oldScale*camera.scale-mouse.rx;
        camera.y=(camera.y+mouse.ry)/oldScale*camera.scale-mouse.ry;
        return true;
    }
})();

const supplier4=new CodeNodeHolder(-150,-100,nodes.value("number",4), "4");
const adder = nodes.math("add");
new CodeNodeHolder(0,0,adder.connect(supplier4.node,"value","a"), "Add").parent(root);
supplier4.parent(root);
new CodeNodeHolder(-150,100,nodes.value("number", 5), "5").parent(root);
setInterval(()=>{
    console.log(adder.call().result);
},1000)

function render(){
    root.render();
    canvas.style.cursor = root.cursor(mouse.x,mouse.y) ?? "default";
    requestAnimationFrame(render);
}
render();