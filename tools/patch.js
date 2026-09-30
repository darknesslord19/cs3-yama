// CS3 yamalayıcı: baksmali, smali ve yama mantığı (domain-ekle.html / domain-sistem.html betikleri aynen kullanılır)
const fs=require('fs'),path=require('path'),cp=require('child_process');
const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const q=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
const sh=c=>{console.log('$ '+c);cp.execSync(c,{stdio:'inherit',maxBuffer:1<<28})};
const W='work',CPATH='"tools/jars/*"',FAKE=!!process.env.FAKE_DEX;
const log=[],alerts=[];
function walk(d,o=[]){for(const n of fs.readdirSync(d)){const p=path.join(d,n);fs.statSync(p).isDirectory()?walk(p,o):n.endsWith('.smali')&&o.push(p)}return o}
function loadJs(file){const m=fs.readFileSync(file,'utf8').match(/<script>([\s\S]*)<\/script>/);if(!m)throw new Error(file+': betik bulunamadı');return m[1]}
const els={};const el=id=>els[id]||(els[id]={style:{},dataset:{},value:'',placeholder:'',className:'',textContent:'',innerHTML:''});
global.document={querySelector:id=>el(id),createElement:()=>({click(){}})};
global.alert=m=>{alerts.push(String(m));console.log('UYARI: '+m)};

(async()=>{
 fs.rmSync(W,{recursive:true,force:true});fs.mkdirSync(W+'/cs3',{recursive:true});fs.mkdirSync('out',{recursive:true});
 sh(`unzip -q -o ${q(cfg.cs3)} -d ${W}/cs3`);
 const dexes=fs.readdirSync(W+'/cs3').filter(n=>/^classes\d*\.dex$/.test(n));
 if(!dexes.length)throw new Error('cs3 içinde classes.dex yok');
 console.log('dex dosyaları: '+dexes.join(', '));
 if(FAKE){fs.cpSync(cfg.fakeSmali,W+'/smali',{recursive:true})}
 else for(const d of dexes)sh(`java -cp ${CPATH} org.jf.baksmali.Main d -a 30 -o ${W}/smali ${q(W+'/cs3/'+d)}`);
 const files=walk(W+'/smali').map(p=>({name:path.relative(W+'/smali',p).split(path.sep).join('/'),text:fs.readFileSync(p,'utf8')}));
 console.log('smali dosyası: '+files.length);

 let out=[],report='';
 global.__FILES=files;global.__CFG=cfg;
 if(cfg.mode==='ekle'){
  const js=loadJs('tools/domain-ekle.html');
  global.__RES=await eval(js+`;(async()=>{
   files=__FILES;scan();el('#url').value=__CFG.url;
   if(__CFG.key)mains.forEach(m=>m.key=__CFG.key);
   let saved=null;save=(b)=>{saved=b};dl();
   if(!saved)throw new Error('Yama üretilemedi: '+(mains.length?'bilinmeyen hata':'ana sınıf bulunamadı'));
   const o=await readZip(await saved.arrayBuffer());
   const rp=['Mod: yalnızca alan adı takibi','Ana sınıflar: '+mains.map(m=>m.cls+' (anahtar '+m.key+', '+m.g+' get, '+m.p+' post)').join('; '),'Extractor: '+(exts.map(x=>x.cls).join(', ')||'-')];
   return {out:o,report:rp.join('\\n')}})()`);
  out=__RES.out;report=__RES.report;
 }else{
  const js=loadJs('tools/domain-sistem.html');
  global.__DONOR=cfg.donor?fs.readFileSync(cfg.donor):null;
  global.__RES=await eval(js+`;(async()=>{
   if(!__DONOR)throw new Error('Domains zip yok');
   tgt=__FILES;don=await readZip(__DONOR.buffer.slice(__DONOR.byteOffset,__DONOR.byteOffset+__DONOR.length));run();
   if(!st.plugs.length)throw new Error('Plugin sınıfı (load) bulunamadı');if(!st.du)throw new Error('DomainUpdateUi domains zip içinde yok');
   if(__CFG.url)el('#url').value=__CFG.url;if(__CFG.tg)el('#tg').value=__CFG.tg;
   const o=build();audit();
   return {out:o,report:'Mod: ayar ekranlı domain sistemi\\n'+el('#rp').innerHTML.replace(/<\\/div>/g,'\\n').replace(/<[^>]+>/g,'').trim()}})()`);
  out=__RES.out;report=__RES.report;
 }
 let changed=0,added=0;
 for(const f of out){const p=path.join(W,'smali',f.name);fs.mkdirSync(path.dirname(p),{recursive:true});const ex=fs.existsSync(p);fs.writeFileSync(p,f.text);ex?changed++:added++}
 console.log(`yazıldı: ${changed} değişen, ${added} yeni dosya`);
 report+=`\nDosyalar: ${changed} değişti, ${added} eklendi`;
 if(alerts.length)report+='\nUyarılar: '+alerts.join(' | ');

 for(const d of dexes)fs.rmSync(path.join(W,'cs3',d));
 if(FAKE)fs.writeFileSync(W+'/cs3/classes.dex','FAKEDEX');
 else sh(`java -cp ${CPATH} org.jf.smali.Main a -a 30 -o ${W}/cs3/classes.dex ${W}/smali`);
 const name=cfg.outName||'plugin.cs3';
 fs.rmSync('out/'+name,{force:true});
 sh(`cd ${W}/cs3 && zip -q -r -X ${q(path.resolve('out',name))} .`);
 fs.writeFileSync('out/report.txt',report+'\n');
 console.log('\n'+report+'\n\nHazır: out/'+name);
})().catch(e=>{console.error('HATA: '+e.message);fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/report.txt','HATA: '+e.message+'\n');process.exit(1)});
