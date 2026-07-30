import { networkInterfaces } from "os";
import qrcode from "qrcode";

export function init(website){
    const linkUrl = "http://"+Object.values(networkInterfaces())
        .reduce((r, list) =>
                r.concat(list.reduce((rr, i) =>
                        rr.concat(i.family==='IPv4' && !i.internal && i.address || []),
                    [])),
            []).filter(ip => ip.startsWith("192."))[0]+":4000";
    if(linkUrl) console.log(`Scan the above link or visit ${linkUrl} if you are on a different device (must be on the same wifi network`)
    console.log("App hosted at http://localhost:4000");

    website.get("/src/dev.js", (req, res) => {
        res.setHeader('content-type', 'text/javascript');
        res.send("export default true;");
    });
}
