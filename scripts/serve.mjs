import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/engine.mjs':'engine.mjs','/app.mjs':'app.mjs'};
for(const name of ['keyboard','bootstrap'])files['/'+name+'.mjs']=name+'.mjs';
for(const name of ['polytype.js','polytype_bg.wasm'])files['/pkg/'+name]='pkg/'+name;
files['/dictionary-notices.txt']='dictionary-notices.txt';
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',js:'text/javascript; charset=utf-8',wasm:'application/wasm',txt:'text/plain; charset=utf-8'};
const pages=process.argv.includes('--pages');
const prefix=pages?'/polytype':'';
const port=Number(process.env.PORT||(pages?4174:4173));
const server=http.createServer(async(req,res)=>{
 const requested=new URL(req.url,'http://localhost').pathname;
 const path=requested.startsWith(prefix+'/')?requested.slice(prefix.length):null;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
 const name=files[path];if(!name){res.writeHead(404);res.end('Not found');return}
 try{const data=await readFile(new URL('../'+(pages?'dist/':'web/')+name,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(500);res.end('Unable to read asset')}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>console.log(`Polytype: http://127.0.0.1:${server.address().port}${prefix}/`));
