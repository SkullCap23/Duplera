import {chromium} from '@playwright/test';import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {spawn} from 'node:child_process';
const scenes=JSON.parse(await readFile('.local/demo/scenes.json','utf8'));
const server=createServer(async(req,res)=>{try{const path=new URL(req.url??'/', 'http://localhost').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><title>Duplera walkthrough renderer</title><body></body></html>');return;}if(!/^\/(scene-\d{2}\.png|voice-\d{2}\.wav)$/.test(path)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.endsWith('.png')?'image/png':'audio/wav');res.end(await readFile('.local/demo'+path));}catch{res.writeHead(500);res.end()}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Preview server unavailable');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1020}});await page.addInitScript({content:'window.__name=(value)=>value;'});await page.goto('http://127.0.0.1:'+address.port);
 await page.exposeFunction('reportScene',(title:string)=>console.log('Rendering: '+title));
 const video=await page.evaluate(async(scenes:any[])=>{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=1020;document.body.append(canvas);const ctx=canvas.getContext('2d')!;
  const audio=new AudioContext(),destination=audio.createMediaStreamDestination();await audio.resume();
  const stream=canvas.captureStream(10);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
  const mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm;codecs=vp8,opus';
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:1400000,audioBitsPerSecond:96000}),parts:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
  const stopped=new Promise<Blob>(resolve=>recorder.onstop=()=>resolve(new Blob(parts,{type:'video/webm'})));
  let current:any,image:HTMLImageElement|undefined,active=true,duration=0;
  function draw(){ctx.fillStyle='#f4f6f5';ctx.fillRect(0,0,1280,1020);if(image)ctx.drawImage(image,0,0,1280,900);ctx.fillStyle='#173c2e';ctx.fillRect(0,900,1280,120);if(current){ctx.fillStyle='#fff';ctx.font='bold 23px Arial';ctx.fillText(current.title,24,930);ctx.font='18px Arial';let line='',y=957;for(const word of current.narration.split(' ')){if(ctx.measureText(line+word).width>1220){ctx.fillText(line,24,y);y+=23;line='';}line+=word+' ';}ctx.fillText(line,24,y);}if(active)requestAnimationFrame(draw);}
  draw();recorder.start(1000);
  for(let i=0;i<scenes.length;i++){
   current=scenes[i];image=new Image();image.src='/'+current.file;await image.decode();
   const buffer=await audio.decodeAudioData(await(await fetch('/voice-'+String(i+1).padStart(2,'0')+'.wav')).arrayBuffer());duration+=buffer.duration;
   await (window as any).reportScene(current.title);const source=audio.createBufferSource();source.buffer=buffer;source.connect(destination);await new Promise<void>(resolve=>{source.onended=()=>resolve();source.start()});
  }
  active=false;recorder.stop();const blob=await stopped;await audio.close();for(const t of stream.getTracks())t.stop();const bytes=new Uint8Array(await blob.arrayBuffer());let encoded='';for(let i=0;i<bytes.length;i+=32768)encoded+=String.fromCharCode(...bytes.subarray(i,i+32768));return {base64:btoa(encoded),duration,mimeType};
 },scenes);
 await mkdir('docs/demo',{recursive:true});await writeFile('.local/demo/walkthrough-stream.webm',Buffer.from(video.base64,'base64'));
 const encoder=process.env.FFMPEG_PATH??resolve(process.env.LOCALAPPDATA??'C:/Users/ASUS/AppData/Local','ms-playwright/ffmpeg-1013/ffmpeg-win64.exe');
 const code=await new Promise<number>((resolve,reject)=>{const child=spawn(encoder,['-hide_banner','-loglevel','error','-y','-i','.local/demo/walkthrough-stream.webm','-c','copy','docs/demo/walkthrough.webm'],{shell:false,stdio:'inherit'});child.on('error',reject);child.on('exit',c=>resolve(c??1));});if(code!==0)throw new Error('Video remux failed');
 await writeFile('docs/demo/manifest.json',JSON.stringify({createdAt:new Date().toISOString(),durationSeconds:video.duration,format:video.mimeType,width:1280,height:1020,source:'Actual local synthetic invoice workflow screenshots; generated Windows speech narration; automated test-wallet bridge, no real funds',scenes:scenes.map((s:any)=>({title:s.title,narration:s.narration}))},null,2));console.log('Walkthrough saved: '+video.duration.toFixed(1)+' seconds.');
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
