/** Offline regeneration: npx tsx scripts/reference/build-registration-ranking.ts */
import { readFileSync,writeFileSync } from 'node:fs';
import { loadReferences } from '../../models/reference';
const data=loadReferences(),normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const key=(make:string,model:string)=>normalize(make)+'/'+normalize(model);
const families=new Map(data.msrp.map(r=>[r.make+'/'+r.model,{make:r.make,model:r.model,registrations:0}]));
const aliases=new Map(data.msrp.flatMap(r=>[r.model,...r.modelAliases].map(m=>[key(r.make,m),r.make+'/'+r.model] as const)));
for(const [make,raw,model] of [['CHEVROLET','SILVERADO','Silverado 1500'],['GMC','SIERRA','Sierra 1500'],['DODGE','RAM','Ram 1500']])aliases.set(key(make!,raw!),make+'/'+model);
for(const line of readFileSync('scripts/reference/ranked-models.csv','utf8').trim().split(/\r?\n/).slice(1)) {
  const fields=line.match(/"(?:[^"]|"")*"|[^,]+/g)!.map(s=>s.replace(/^"|"$/g,'').replace(/""/g,'"'));
  const name=aliases.get(key(fields[2]!,fields[3]!)),family=name?families.get(name):undefined;
  if(family)family.registrations+=Number(fields[4]);
}
const rows=[...families.values()].sort((a,b)=>b.registrations-a.registrations||(a.make+'/'+a.model).localeCompare(b.make+'/'+b.model));
writeFileSync('models/config/registrationRanking.json',JSON.stringify(rows,null,2)+'\n');
