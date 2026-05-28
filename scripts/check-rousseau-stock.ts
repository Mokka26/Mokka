// Checkt per Rousseau-product de voorraadstatus op de bron-detailpagina.
// Verbergt (hidden=true) producten die niet op voorraad zijn (datum i.p.v. "Stock").
// Dry-run default; --apply om te verbergen.
import {config} from 'dotenv'; config({path:'.env.local'});
import {PrismaClient} from '@prisma/client'; const p=new PrismaClient();
const APPLY=process.argv.includes('--apply');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
function decode(s:string){return s.replace(/&nbsp;/g,' ').replace(/&#0?39;/g,"'").replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d));}
function lines(html:string){let t=html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,'\n');return decode(t).split('\n').map(x=>x.trim()).filter(Boolean);}
async function fetchHtml(url:string){const r=await fetch(url,{headers:{'User-Agent':UA}});if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const prods=await p.product.findMany({where:{source:'Rousseau',deletedAt:null},select:{id:true,slug:true,category:true,colorName:true,specs:true,name:true}});
  console.log(`Rousseau-producten: ${prods.length}  (${APPLY?'APPLY':'dry-run'})\n`);
  const oos:string[]=[]; let unknown=0;
  for(const pr of prods){
    const sku=(()=>{try{return JSON.parse(pr.specs||'{}').Artikelnummer;}catch{return null;}})();
    if(!sku){console.log(`? ${pr.slug}: geen sku`);unknown++;continue;}
    const base=pr.category==='bedden'?'bedden':'kledingkasten';
    const url=`https://www.rousseau.be/nl/producten/slaapkamer/${base}/${sku}`;
    const color=(pr.colorName||'').toLowerCase();
    const bedSize=pr.category==='bedden'?(pr.slug.match(/(\d+x\d+)/)?.[1]??null):null;
    let width:string|null=null;
    if(pr.category!=='bedden'){try{width=(JSON.parse(pr.specs||'{}').Afmetingen||'').match(/B\s*(\d+)/)?.[1]??null;}catch{}}
    try{
      const html=await fetchHtml(url);
      if(/<title>[^<]*404|Not Found/i.test(html) || html.length<5000){
        console.log(`🔴 404/weg                          ${pr.slug}`); oos.push(pr.id); await sleep(250); continue;
      }
      const ls=lines(html);
      // alleen ECHTE grid-regels: "Kleur - 80 cm" of "Kleur - 90x200" (sluit titelregel uit)
      const pairs:{label:string,status:string}[]=[];
      for(let i=0;i<ls.length-1;i++) if(/^.{2,40}\s-\s(\d{2,3}\s*cm|\d{2,3}x\d{2,3})$/i.test(ls[i])) pairs.push({label:ls[i].toLowerCase(),status:ls[i+1]});
      let status:string|null=null;
      for(const pp of pairs){
        if(color && !pp.label.includes(color)) continue;
        if(bedSize){ if(pp.label.includes(bedSize.toLowerCase())){status=pp.status;break;} }
        else if(width){ if(new RegExp('\\b'+width+'\\s*cm$').test(pp.label)){status=pp.status;break;} }
        else { status=pp.status; break; }
      }
      // fallback: grid op alleen kleur ("Wit" / "Stock"), zonder maat (opbergkast/ray)
      if(status===null && color){
        for(let i=0;i<ls.length-1;i++){
          if(ls[i].toLowerCase()===color && /stock|voorraad|dropshipping|uitverkocht|\d{1,2}\/\d{1,2}\/\d{4}/i.test(ls[i+1])){status=ls[i+1];break;}
        }
      }
      const isDate = status!=null && /\d{1,2}\/\d{1,2}\/\d{4}/.test(status);
      const isOut = isDate || (status!=null && /uitverkocht|niet (meer )?leverbaar|sold ?out/i.test(status));
      const inStock = status!=null && /stock|voorraad|dropshipping/i.test(status) && !isOut;
      const mark = isOut?`🔴 niet leverbaar (${status})`:(inStock?`✅ ${status}`:`⚠ onbekend (${status??'geen match'})`);
      console.log(`${mark.padEnd(40)} ${pr.slug}`);
      if(isOut) oos.push(pr.id);
      else if(!inStock) unknown++;
      await sleep(250);
    }catch(e){console.log(`✗ ${pr.slug}: ${e instanceof Error?e.message:e}`);unknown++;}
  }
  console.log(`\nOut-of-stock: ${oos.length} · onbekend: ${unknown}`);
  if(APPLY && oos.length){await p.product.updateMany({where:{id:{in:oos}},data:{hidden:true}});console.log(`Verborgen: ${oos.length}`);}
  else if(oos.length) console.log('(dry-run — run met --apply om te verbergen)');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
