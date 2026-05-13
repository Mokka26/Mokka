import sharp from "sharp";
for (const f of [
  "C:/Users/konia/AppData/Local/Temp/src-Tobi.jpeg",
  "C:/Users/konia/AppData/Local/Temp/src-Sanchez.jpg",
  "C:/Users/konia/AppData/Local/Temp/src-Memory.png",
]) {
  const m = await sharp(f).metadata();
  console.log(`${f.split("/").pop()}: ${m.width}x${m.height}`);
}
