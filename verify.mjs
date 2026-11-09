import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
const base='http://localhost:3000';
for(const route of ['/','/styles.css','/assets/site.js','/logo.svg','/privacy']){const result=await fetch(base+route);assert.equal(result.status,200,route);assert.ok((await result.text()).length>50);}
for(const route of ['/data/enquiries.jsonl','/server.mjs','/README.md','/missing'])assert.equal((await fetch(base+route)).status,404,route);
const post=(data,origin)=>fetch(base+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(data)});
assert.equal((await post({})).status,400);
assert.equal((await post({},'https://example.com')).status,403);
assert.equal((await post({website:'spam'})).status,200);
const sample={name:'Website QA',business:'TEST RECORD',email:'qa@example.com',service:'Custom workflows',message:'Temporary end-to-end verification',consent:true};
const result=await post(sample);assert.equal(result.status,201);const saved=await result.json();assert.ok(saved.id);
const records=await readFile(new URL('./data/enquiries.jsonl',import.meta.url),'utf8');assert.ok(records.includes(saved.id));
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
for(const [,anchor]of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(anchor),'Missing anchor: '+anchor);
for(const [,id]of html.matchAll(/<(?:input|textarea|select)[^>]*\bid="([^"]+)"/g))assert.ok(html.includes(`for="${id}"`),'Missing label: '+id);
console.log('PASS: page/assets/privacy, private file protection, form validation, origin rejection, honeypot, successful enquiry persistence, unique IDs, links, field labels.');
// Remove only this generated QA record; preserve any other enquiries.
const {writeFile}=await import('node:fs/promises');const remaining=records.split('\n').filter(line=>line&&!line.includes(saved.id));
if(remaining.length)await writeFile(new URL('./data/enquiries.jsonl',import.meta.url),remaining.join('\n')+'\n');else await rm(new URL('./data/enquiries.jsonl',import.meta.url));
