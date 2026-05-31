import {config} from 'dotenv'; config({path:'.env.local'});
import {PrismaClient} from '@prisma/client'; const p=new PrismaClient();
import fs from 'fs';
const APPLY=process.argv.includes('--apply');
const dims:Record<string,number[][]>=JSON.parse(fs.readFileSync('C:/Users/konia/AppData/Local/Temp/salt_dims.json','utf8'));
// model-keys als set; match op losse woorden uit de productnaam (geen regex)
const modelSet=new Set(Object.keys(dims).filter(k=>k.length>=4));
function matchModel(name:string):string|null{
  const words=name.toUpperCase().split(/[^A-ZÇĞİÖŞÜ0-9]+/).filter(Boolean);
  for(const w of words){ if(modelSet.has(w)) return w; }
  return null;
}
async function main(){
  const banken=await p.product.findMany({where:{category:{in:['bankstellen','hoekbanken','banken','fauteuils']},deletedAt:null},select:{id:true,slug:true,name:true,specs:true,category:true}});
  let filled=0, nomatch=0; const log:string[]=[];
  for(const b of banken){
    let s:Record<string,string>={}; try{s=JSON.parse(b.specs||'{}');}catch{}
    if(s.Afmetingen||s.Afmeting) continue; // alleen ontbrekende
    const m=matchModel(b.name);
    if(!m){ nomatch++; continue; }
    const entries=dims[m];
    // fauteuil → kleinste; bank/hoek → grootste breedte (3-zits)
    const pick = b.category==='fauteuils'
      ? entries.reduce((a,c)=>c[0]<a[0]?c:a)
      : entries.reduce((a,c)=>c[0]>a[0]?c:a);
    const af=`B ${pick[0]} × D ${pick[1]} × H ${pick[2]} cm`;
    s.Afmetingen=af;
    log.push(`  ${b.name.slice(0,38).padEnd(38)} ← ${m}  ${af}`);
    if(APPLY) await p.product.update({where:{id:b.id},data:{specs:JSON.stringify(s)}});
    filled++;
  }
  console.log(`Banken zonder maat → gevuld: ${filled} · geen PDF-match: ${nomatch}`);
  console.log(log.slice(0,30).join('\n'));
  if(!APPLY) console.log('\n(DRY-RUN — run met --apply)');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
