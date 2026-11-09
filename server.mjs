import http from 'node:http';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const root = fileURLToPath(new URL('.', import.meta.url));
const routes = {'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/assets/site.js':'assets/site.js','/logo.svg':'logo.svg','/privacy':'privacy.html','/privacy.html':'privacy.html'};
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const attempts = new Map();
const server = http.createServer(async (req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname==='/api/enquiries' && req.method==='POST'){
      if(process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED){
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return reply(413,{error:'Your message is too long.'});}
        req.body=raw;res.status=(status)=>{res.statusCode=status;return res;};res.json=(body)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
        const {default:handler}=await import('./api/enquiries.js');return handler(req,res);
      }
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`) return reply(403,{error:'Request origin not allowed.'});
      if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required.'});
      const ip=req.socket.remoteAddress; const now=Date.now();
      for(const [key,value] of attempts)if(now-value.time>600000)attempts.delete(key);
      const record=attempts.get(ip)||{count:0,time:now};
      if(record.count>=10)return reply(429,{error:'Too many requests. Please try again in ten minutes.'});
      record.count++;attempts.set(ip,record);
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return reply(413,{error:'Your message is too long.'});}
      let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid request.'});}
      if(body.website)return reply(200,{ok:true});
      const fields=['name','business','email','service','message'];
      if(fields.some(key=>typeof body[key]!=='string'||body[key].trim().length<2||body[key].length>3000)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||body.consent!==true)return reply(400,{error:'Please complete all required fields and agree to the privacy notice.'});
      const entry={id:randomUUID(),createdAt:new Date().toISOString(),...Object.fromEntries(fields.map(key=>[key,body[key].trim()])),consent:true};
      await mkdir(path.join(root,'data'),{recursive:true});
      await appendFile(path.join(root,'data','enquiries.jsonl'),JSON.stringify(entry)+'\n');
      return reply(201,{ok:true,id:entry.id});
    }
    if(!['GET','HEAD'].includes(req.method))return reply(405,{error:'Method not allowed.'});
    const file=routes[url.pathname];if(!file){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Page not found.');}
    const data=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){console.error(error.message);reply(500,{error:'We could not save your enquiry. Please try again.'});}
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'127.0.0.1',()=>console.log(`AuronexAI running at http://localhost:${port}`));
