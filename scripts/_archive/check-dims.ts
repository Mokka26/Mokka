import sharp from "sharp";
const a = await sharp("C:/Users/konia/AppData/Local/Temp/tobi-upscale.jpg").metadata();
const b = await sharp("C:/Users/konia/AppData/Local/Temp/tobi-hires.jpg").metadata();
console.log("upscale:", a.width, "x", a.height);
console.log("hires-2000:", b.width, "x", b.height);
