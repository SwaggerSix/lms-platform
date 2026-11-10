// node build.js <pkgdir> <out1.json> ...  -> writes <pkgdir>/activities.js (encoded like course-data.js)
const fs=require('fs'); const [dir,timesFile,...outs]=process.argv.slice(2);
const times=JSON.parse(fs.readFileSync(timesFile));
global.window={}; eval(fs.readFileSync(dir+'/course-data.js','utf8'));
const key=Buffer.from(window.MOSAIC_K,'base64');
let acts=[]; for(const f of outs) acts=acts.concat(JSON.parse(fs.readFileSync(f)));
acts=acts.map(a=>{const t=times[a.id]; if(!t) throw new Error('no time '+a.id); return {...a, mod:t.video.replace(/-part\d+$/,''), video:t.video, t:t.t};});
const bytes=Buffer.from(JSON.stringify(acts),'utf8'); const out=Buffer.alloc(bytes.length);
for(let i=0;i<bytes.length;i++) out[i]=bytes[i]^key[i%key.length]^((i*7)&255);
fs.writeFileSync(dir+'/activities.js','window.MOSAIC_ACTS="'+out.toString('base64')+'";\n');
console.log('wrote',acts.length,'activities,',out.length,'bytes');
