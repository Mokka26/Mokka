import {config} from 'dotenv'; config({path:'.env.local'});
import {PrismaClient} from '@prisma/client'; const p=new PrismaClient();
const APPLY=process.argv.includes('--apply');

function translate(name:string): string {
  let n=name;
  n=n.replace(/\bCeiling Lamp\b/gi,'Plafondlamp');
  n=n.replace(/\bTable Lamp\b/gi,'Tafellamp');
  n=n.replace(/\bFloor Lamp\b/gi,'Vloerlamp');
  n=n.replace(/\bWall (LED )?Lamp\b/gi,'Wandlamp');
  n=n.replace(/\bDecoration Lamp\b/gi,'Sfeerlamp');
  n=n.replace(/\bWall Dressoir\b/gi,'Dressoir');
  n=n.replace(/\b(Table|Windy|Daisy) Product\b/gi,'Tafelblad');
  n=n.replace(/\bProduct\b/g,'Tafelblad');
  n=n.replace(/\bVeneer\b/gi,'Fineer');
  n=n.replace(/\bSinter Stone\b/gi,'Sintersteen');
  n=n.replace(/\bframe\b/gi,'onderstel');
  n=n.replace(/\bGlass\b/gi,'Glas');
  n=n.replace(/\bMarble\b/gi,'Marmer');
  return n.replace(/\s{2,}/g,' ').trim();
}
function modelCode(slug:string): string|null {
  const m=slug.match(/\b(gh|ql|art)\s?-?\d{2,}[a-z]?\d*/i);
  if(m) return m[0].replace(/[\s-]/g,'').toUpperCase();
  const d=slug.match(/\b\d{3,}\b/); // eerste 3+cijferige token
  return d?d[0]:null;
}

async function main(){
  const all=await p.product.findMany({where:{deletedAt:null},select:{id:true,slug:true,name:true,hidden:true}});
  // stap 1: vertaling
  const step1=all.map(a=>({...a,nn:translate(a.name)}));
  // stap 2: dedup onder ZICHTBARE producten — bij botsing modelcode erbij
  const visCount=new Map<string,number>();
  for(const a of step1) if(!a.hidden) visCount.set(a.nn,(visCount.get(a.nn)||0)+1);
  const final=step1.map(a=>{
    if(!a.hidden && (visCount.get(a.nn)||0)>1){
      const mc=modelCode(a.slug);
      if(mc && !a.nn.includes(mc)) return {...a,fn:`${a.nn} ${mc}`};
    }
    return {...a,fn:a.nn};
  });
  const changes=final.filter(a=>a.fn!==a.name);
  // resterende dups na dedup (zichtbaar)
  const fc=new Map<string,number>(); for(const a of final) if(!a.hidden) fc.set(a.fn,(fc.get(a.fn)||0)+1);
  const dups=[...fc].filter(([,n])=>n>1);
  console.log(`Te wijzigen: ${changes.length}`);
  console.log(`Resterende dubbele namen (zichtbaar) na dedup: ${dups.length}`);
  dups.slice(0,10).forEach(([n,c])=>console.log(`   ${c}× ${n}`));
  console.log('\n— Voorbeelden dedup —');
  for(const c of final.filter(a=>a.fn!==a.nn).slice(0,10)) console.log(`  ${c.name}  →  ${c.fn}`);
  if(APPLY){
    for(const c of changes) await p.product.update({where:{id:c.id},data:{name:c.fn}});
    console.log(`\n✅ Toegepast: ${changes.length} namen.`);
  } else console.log('\n(DRY-RUN)');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
