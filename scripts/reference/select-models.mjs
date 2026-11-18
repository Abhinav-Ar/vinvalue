import fs from 'node:fs';
const endpoint = 'https://data.wa.gov/resource/brw6-jymh.json';
const params = new URLSearchParams({
  '$select':'make,model,sum(vehicle_record_count) as registration_count',
  '$group':'make,model',
  '$limit':'50000'
});
const canonical = new Map([
 ['CHEV','CHEVROLET'],['CHEVROLET','CHEVROLET'],['VW','VOLKSWAGEN'],['MITS','MITSUBISHI'],
 ['MERC','MERCEDES-BENZ'],['TOYOTA','TOYOTA'],['FORD','FORD'],['HONDA','HONDA'],['SUBARU','SUBARU'],
 ['JEEP','JEEP'],['BMW','BMW'],['MAZDA','MAZDA'],['NISSAN','NISSAN'],['HYUNDAI','HYUNDAI'],['KIA','KIA'],
 ['TESLA','TESLA'],['LEXUS','LEXUS'],['ACURA','ACURA'],['AUDI','AUDI'],['VOLVO','VOLVO'],['PORSCHE','PORSCHE'],
]);
const url = `${endpoint}?${params}`;
const response = await fetch(url);
if (!response.ok) throw new Error(`WA SODA request failed: ${response.status}`);
const source = await response.json();
const rows = source.map(r => ({
  rawMake: String(r.make ?? '').trim().toUpperCase(),
  make: canonical.get(String(r.make ?? '').trim().toUpperCase()) ?? String(r.make ?? '').trim().toUpperCase(),
  model: String(r.model ?? '').trim(),
  registrationCount: Number(r.registration_count ?? 0),
})).filter(r => r.make && r.model && Number.isFinite(r.registrationCount)).sort((a,b)=>b.registrationCount-a.registrationCount);
const total = rows.reduce((n,r)=>n+r.registrationCount,0);
fs.mkdirSync('scripts/reference', {recursive:true});
const header = 'rank,rawMake,make,model,registrationCount,cumulativeCount,cumulativeShare\n';
let cumulative = 0;
const body = rows.map((r,i)=>{ cumulative += r.registrationCount; return `${i+1},${JSON.stringify(r.rawMake)},${JSON.stringify(r.make)},${JSON.stringify(r.model)},${r.registrationCount},${cumulative},${(cumulative/total).toFixed(6)}`; }).join('\n')+'\n';
fs.writeFileSync('scripts/reference/ranked-models.csv', header+body);
console.log(`WA rows=${rows.length} total=${total}; ranked-models.csv written; top-100 share=${(rows.slice(0,100).reduce((n,r)=>n+r.registrationCount,0)/total*100).toFixed(2)}%`);
