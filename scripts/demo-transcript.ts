import {readFile,writeFile,mkdir} from 'node:fs/promises';
const scenes=JSON.parse(await readFile('.local/demo/scenes.json','utf8'));let elapsed=0;
const stamp=(seconds:number)=>{const ms=Math.round(seconds*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');};
const cues:string[]=[],paragraphs:string[]=[];
for(let i=0;i<scenes.length;i++){
 const wav=await readFile('.local/demo/voice-'+String(i+1).padStart(2,'0')+'.wav');let rate=0,size=0;
 if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw new Error('Unsupported narration audio');
 for(let offset=12;offset+8<=wav.length;){const name=wav.toString('ascii',offset,offset+4),length=wav.readUInt32LE(offset+4);if(name==='fmt ')rate=wav.readUInt32LE(offset+16);if(name==='data')size=length;offset+=8+length+(length%2);}
 if(!rate||!size)throw new Error('Narration has no audio frames');const end=elapsed+size/rate;
 cues.push((i+1)+'\n'+stamp(elapsed)+' --> '+stamp(end)+'\n'+scenes[i].narration+'\n');paragraphs.push('## '+scenes[i].title+'\n\n'+scenes[i].narration);elapsed=end;
}
await mkdir('docs/demo',{recursive:true});await writeFile('docs/demo/captions.vtt','WEBVTT\n\n'+cues.join('\n'));await writeFile('docs/demo/TRANSCRIPT.md','# Narrated local walkthrough\n\n'+paragraphs.join('\n\n')+'\n');console.log('Accessible transcript and captions written for '+elapsed.toFixed(1)+' seconds.');
