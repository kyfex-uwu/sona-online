import {camera, renderer, scene} from "./client/clientConsts.js";
import type {Scene} from "./client/scenes/Scene.js";
import Stats from "stats.js";
import {button, buttonId, lerp, particles, registerDrawCallback} from "./client/ui.js";
import {LoadScene} from "./client/scenes/LoadScene.js";
import {loadLocalNetwork} from "./networking/frontend/LocalServer.js";

/////
// version 0.1.0
/////

const stats = new Stats();
stats.showPanel(0);
// document.getElementById("stats")!.appendChild(stats.dom);

let currScene:Scene = new LoadScene();
export function setScene(scene:()=>Scene){
    currScene.exit();
    currScene=scene();
}

//--

let lastTime=0;
renderer.setAnimationLoop((time) => {
    stats.begin();
    currScene.tick();

    const deltaTime = time-lastTime;
    for(const particle of particles){
        particle.sprite.position.add(particle.velocity);
        particle.velocity.multiplyScalar(particle.drag);

        if(particle.data[particle.index-1] !== undefined || particle.time === 0) {
            let delta = 1-(particle.data[particle.index]!.timeIndex-particle.time) /
                particle.data[particle.index]!.time;
            if(isNaN(delta)) delta = 1;

            particle.sprite.material.opacity = lerp(
                particle.data[particle.index]!.opacity,
                particle.data[particle.index-1]?.opacity ?? 0,
                delta);
            particle.sprite.material.color =
                (particle.data[particle.index-1]?.color ?? particle.data[particle.index]!.color).clone().lerp(
                    particle.data[particle.index]!.color,
                    delta);
            const scale = lerp(
                particle.data[particle.index]!.size,
                particle.data[particle.index-1]?.size ?? 0,
                delta);
            particle.sprite.scale.set(scale,scale,1);
        }

        particle.time+=deltaTime;
        while(particle.data[particle.index] !== undefined &&
                particle.time>particle.data[particle.index]!.timeIndex) {
            particle.index++;
            if(particle.index>=particle.data.length){
                particle.dead=true;
                particle.sprite.removeFromParent();
            }
        }
    }
    for(let i=0;i<particles.length;i++){
        if(particles[i]!.dead){
            particles.splice(i,1);
            i--;
        }
    }

    renderer.render(scene, camera);
    stats.end();
    lastTime=time;
});

const bugReportButton = buttonId();
registerDrawCallback(100,(p5,scale)=>{
    p5.push();
    p5.textSize(scale*0.1);
    p5.textAlign(p5.RIGHT,p5.BOTTOM);
    p5.text(`Version ${VERSION_NUMBER}\nThis is only a beta build,\neverything is subject to change`,p5.width-scale*0.02,p5.height-scale*0.02);
    button(p5,0,0,scale*0.7,scale*0.2,"Report Bug",()=>{
        const bug = prompt("Explain your bug");
        if(bug!==null)
            fetch("https://discord.com/api/webhooks/1132434535594860615/tEeTWFurxs3TohPjikgLUwYK9_2EpFfmnpdJOvPkCCiwdGt7elocUQUy_ij4ELF9cw3o",{
                method:"POST",
                body:JSON.stringify({
                    username:"SONA BUGS",
                    content:bug
                })
            });
        alert("Bug report sent, thanks!");
    }, scale/2, bugReportButton);
    p5.pop();
});
const VERSION_NUMBER = "beta 1.0.0"

loadLocalNetwork();
