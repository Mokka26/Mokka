import {config} from 'dotenv'; config({path:'.env.local'});
import {PrismaClient} from '@prisma/client'; const p=new PrismaClient();
import fs from 'fs';
const APPLY=process.argv.includes('--apply');
const specs:Record<string,{sizes:string[],spring:boolean,fabrics:string[]}>=JSON.parse(fs.readFileSync('C:/Users/konia/AppData/Local/Temp/ow_pdf_specs.json','utf8'));
const FAB:Record<string,string>={Knitting:'gebreide stof',Tencel:'Tencel',Wool:'wol',Kapok:'kapok',Plush:'pluche',Magnetic:'magneettherapie-stof',Silver:'zilvergaren',Bamboo:'bamboe',Cotton:'katoen',Organic:'organic',Face:'',Viscose:'viscose',Jacquard:'jacquard',Aloe:'aloë vera'};
// PDF-model → eerste woord (lowercase) als matchsleutel
const byWord=new Map<string,{sizes:string[],spring:boolean,fabrics:string[]}>();
for(const [k,v] of Object.entries(specs)){ const w=k.toLowerCase().split(' ')[0]; if(!byWord.has(w)) byWord.set(w,v); }
async function main(){
  const beds=await p.product.findMany({where:{source:'One World',deletedAt:null},select:{id:true,slug:true,name:true,specs:true}});
  let matched=0; const log:string[]=[];
  for(const b of beds){
    const model=b.slug.replace(/^ow-/,'').split('-')[0];
    const v=byWord.get(model);
    if(!v){ continue; }
    matched++;
    let s:Record<string,string>={}; try{s=JSON.parse(b.specs||'{}');}catch{}
    if(v.sizes.length){
      const sz=v.sizes.map(z=>z.replace('x','×')).join(', ');
      s.Afmetingen=`Matrasmaten: ${sz} cm`;
    }
    const fabs=[...new Set(v.fabrics.map(f=>FAB[f]).filter(Boolean))];
    const mat=[v.spring?'Pocketvering':'', fabs.length?fabs.join(', ')+' bekleding':''].filter(Boolean).join(' · ');
    if(mat) s.Materiaal=mat;
    log.push(`  ${b.name.padEnd(24)} ← ${model}  | ${s.Afmetingen||''} | ${s.Materiaal||''}`);
    if(APPLY) await p.product.update({where:{id:b.id},data:{specs:JSON.stringify(s)}});
  }
  console.log(`One World bedden: ${beds.length} · gematcht met PDF: ${matched}`);
  console.log(log.join('\n'));
  if(!APPLY) console.log('\n(DRY-RUN — run met --apply)');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
