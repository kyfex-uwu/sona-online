import { networkInterfaces } from "os";
import qrcode from "qrcode";

export function init(){
    const linkUrl = "http://"+Object.values(networkInterfaces())
        .reduce((r, list) =>
                r.concat(list.reduce((rr, i) =>
                        rr.concat(i.family==='IPv4' && !i.internal && i.address || []),
                    [])),
            []).filter(ip => !ip.startsWith("192."))[0]+":4000";
    qrcode.toString(linkUrl, {type:"terminal"}, (e, url)=>console.log(url));

    console.log(`Scan the above link or visit ${linkUrl} if you are on a different device (must be on the same wifi network`)
    console.log("App hosted at http://localhost:4000");
}
