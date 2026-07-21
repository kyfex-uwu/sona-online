import {Scene} from "./Scene.js";
import {camera, modelLoader, scene} from "../clientConsts.js";
import {AmbientLight, Color, CubeTextureLoader} from "three";
import {registerDrawCallback} from "../ui.js";
import {setScene} from "../../index.js";
import {externalPromise} from "../../consts.js";
import {MainMenuScene} from "./MainMenuScene.js";

export class LoadScene extends Scene{
    private readonly releaseDrawCallback;
    private fadeTimer=30;
    private fade = false;
    constructor() {
        super();

        let frame=0;
        this.releaseDrawCallback=registerDrawCallback(1, (p5, scale)=>{
            p5.background(56,85,86,this.fadeTimer/30*255);
            p5.textAlign(p5.CENTER,p5.CENTER);
            p5.fill(255,255,255,this.fadeTimer/30*255);
            p5.textSize(scale*0.25);
            p5.text("Loading"+new Array(Math.floor(frame/50)%4).fill(".").join(""),p5.width/2,p5.height/2);

            frame++;
            if(this.fade) this.fadeTimer--;
            if(this.fadeTimer<0) this.releaseDrawCallback();
        });

        const backgroundPromise = externalPromise();
        const loader = new CubeTextureLoader();
        loader.setPath('/assets/skybox/cloudy/');
        scene.background = loader.load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],()=>{
            backgroundPromise.resolve();
        });

        scene.add(new AmbientLight(new Color(0xffffff), 3));
        scene.add(camera);

        const boardPromise = externalPromise();
        modelLoader.load("/assets/board.glb", model => {
            model.scene.scale.set(10,10,10);
            model.scene.position.set(0,-10,0);
            scene.add(model.scene);
            boardPromise.resolve();
        });



        Promise.all([backgroundPromise,boardPromise]).then(()=>{
            setScene(()=>new MainMenuScene());
        });
    }
    exit(): void {
        this.fade=true;
    }

    tick(): void {}
}
