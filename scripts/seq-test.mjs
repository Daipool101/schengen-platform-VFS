const BASE='https://d2ab400qlgxn2g.cloudfront.net/dev/spaces/xxg4p8gt3sg6/environments/master/entries';
const T='5YpTBRikGN59YHwM18CyGr5F43bFuaak9U8FSMEDmb8';
const H={Authorization:'Bearer '+T,Referer:'https://visa.vfsglobal.com/','Accept-Language':'en-US'};
const q=async(p)=>{const u=new URL(BASE);for(const k in p)u.searchParams.set(k,p[k]);const r=await fetch(u,{headers:H});return r.json();};
const feeCount=(d)=>{const e=(d.includes&&d.includes.Entry)||[];return e.filter(x=>x.fields&&x.fields.table&&/visa fee/i.test(x.fields.table)).length;};
// Mimic the crawl: countryLocation, then countryPage, then onePager
console.log('--- mimicking crawl 3-call sequence for AT ---');
const loc=await q({content_type:'countryLocation','fields.title[match]':'aut > ind > en',include:'10'});
console.log('countryLocation items:', loc.total);
const page=await q({content_type:'countryPage','fields.locale':'aut > ind > en',include:'4'});
console.log('countryPage items:', page.total);
await new Promise(r=>setTimeout(r,2000));
const op=await q({content_type:'onePager','fields.name':'aut > ind > en',include:'10'});
const e=(op.includes&&op.includes.Entry)||[];
console.log('onePager: total='+op.total+' entries='+e.length+' feeTables='+feeCount(op));
