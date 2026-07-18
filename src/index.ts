import {camera, renderer, scene} from "./client/clientConsts.js";
import {frontendInit} from "./networking/LocalServer.js";
import type {Scene} from "./client/scenes/Scene.js";
import Stats from "stats.js";
import {lerp, particles} from "./client/ui.js";
import {LoadScene} from "./client/scenes/LoadScene.js";

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
                particle.data[particle.index]!.color.lerp(
                    particle.data[particle.index-1]?.color ?? particle.data[particle.index]!.color,
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

frontendInit();
