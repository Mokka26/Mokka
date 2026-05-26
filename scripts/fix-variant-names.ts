import {config} from 'dotenv'; config({path:'.env.local'});
import {PrismaClient} from '@prisma/client'; const p=new PrismaClient();
const APPLY=process.argv.includes('--apply');

// Betekenisvolle slug-tokens → NL label. Alleen deze worden teruggezet;
// nummers / "-1" / maat-tokens worden genegeerd (dat zijn de duplicaten → laten).
const MAP: Record<string,string> = {
  white:'Wit', black:'Zwart', 'dark-grey':'Donkergrijs','dark-gray':'Donkergrijs',
  'light-grey':'Lichtgrijs','light-gray':'Lichtgrijs', grey:'Grijs', gray:'Grijs',
  brown:'Bruin', taupe:'Taupe', cream:'Crème', beige:'Beige', gold:'Goud', silver:'Zilver',
  oval:'Ovaal', curve:'Curve', round:'Rond', blocci:'Blocci', clover:'Clover', fungo:'Fungo',
  royal:'Royal', taksim:'Taksim', lotus:'Lotus', ayla:'Ayla', kapadokya:'Kapadokya',
};
// multi-word tokens eerst herkennen
function tokens(slug:string): string[] {
  let s=slug.toLowerCase();
  const found:string[]=[];
  for(const k of ['dark-grey','dark-gray','light-grey','light-gray']) if(s.includes(k)){found.push(k); s=s.replaceAll(k,' ');}
  for(const t of s.split(/[^a-z]+/)) if(t) found.push(t);
  return found;
}
async function main(){
  const vis=await p.product.findMany({where:{deletedAt:null,hidden:false},select:{id:true,slug:true,name:true}});
  const byName=new Map<string,typeof vis>(); for(const v of vis){const a=byName.get(v.name)??[];a.push(v);byName.set(v.name,a);}
  const groups=[...byName].filter(([,a])=>a.length>1);
  const updates:{id:string,from:string,to:string}[]=[];
  for(const [,items] of groups){
    const tokLists=items.map(it=>tokens(it.slug));
    // common tokens = in ALLE members
    const common=tokLists[0].filter(t=>tokLists.every(l=>l.includes(t)));
    // per member: unieke betekenisvolle tokens (in MAP), niet-common
    const labelsPer=items.map((it,i)=>{
      const uniq=tokLists[i].filter(t=>!common.includes(t) && MAP[t]);
      // dedupe + slug-volgorde
      const seen=new Set<string>(); const labels:string[]=[];
      for(const t of uniq){ if(!seen.has(t)){seen.add(t); labels.push(MAP[t]);} }
      return labels;
    });
    // alleen toepassen als ELKE member een onderscheidend label krijgt (anders = dupe → laten)
    if(labelsPer.some(l=>l.length===0)) continue;
    // en de labels moeten de members daadwerkelijk uniek maken
    const newNames=items.map((it,i)=>`${it.name} ${labelsPer[i].join(' ')}`);
    if(new Set(newNames).size!==items.length) continue;
    items.forEach((it,i)=>updates.push({id:it.id,from:it.name,to:newNames[i]}));
  }
  console.log(`Varianten te hernoemen: ${updates.length}\n`);
  for(const u of updates) console.log(`  ${u.from}\n    → ${u.to}`);
  if(APPLY){ for(const u of updates) await p.product.update({where:{id:u.id},data:{name:u.to}}); console.log(`\n✅ Toegepast: ${updates.length}`); }
  else console.log('\n(DRY-RUN)');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
