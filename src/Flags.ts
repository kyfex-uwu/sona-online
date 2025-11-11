import { reactive, html } from '@arrow-js/core';

const descriptions:{[k:string]:string} = {
    CHILI_MAMA_ALL_CANINES:"When Chili Mama is on field, her effect applies to all canines"
}

const flags = reactive({});
function update(key:string, val:any){
    flags[key] = val;
    console.log(val)
    fetch(`/api/flags/${key}`, {method:"POST", body:JSON.stringify(val)});
}
fetch("/api/flags").then((res)=>res.json()).then(obj=>{
    for(const key in obj)
        flags[key] = obj[key];
console.log(flags)
    html`${()=>Object.keys(flags).map(key=>{
        return html`${descriptions[key]||key} ${({
            //@ts-ignore
            number:html`<input type="number" value="${flags[key]}" @input="${(e)=> update(key, parseFloat(e.target.value))}"`,
            //@ts-ignore
            boolean:html`<input type="checkbox" checked="${()=>flags[key]}" @click="${(e)=> update(key, e.target.checked)}">`,
        })[typeof(flags[key]) as "number"|"boolean"]}`;
    })}`(document.getElementById("root")!);
})
