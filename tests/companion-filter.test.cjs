// The companion design list can show all, visible-only or hidden-only companions; hidden ones are marked.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs');
const root=path.resolve(__dirname,'..'),published=JSON.parse(fs.readFileSync(path.join(root,'../Emberwild/data/balance.json')));
test('hidden companions can be filtered and are labelled as not appearing in the game',()=>{
 const r=loadRuntime(root);r.ctx.published=published;r.run("data=__EMBERWILD_VALIDATE_DOCUMENT(published);ensureArrays();currentSection='companions';render();");
 const all=published.companions.length,hidden=published.companions.filter(p=>p.availability==='hidden').length;assert(hidden>0);
 const list=filter=>{r.ctx.f=filter;r.run('selected.companionFilter=f');const p=r.run('data.companions.find(x=>x.id===selected.companionSkillOwner)||data.companions[0]');return {html:r.run('companionDesignList(data.companions.find(x=>x.id===selected.companionSkillOwner)||data.companions[0])'),current:p.id};};
 const a=list('all');assert.match(a.html,new RegExp('全部 '+all));assert.match(a.html,new RegExp('隱藏 '+hidden));assert.equal((a.html.match(/data-companion="/g)||[]).length,all);
 assert.equal((a.html.match(/companion-hidden/g)||[]).length,hidden);assert.match(a.html,/隱藏 · 遊戲中不出現/);
 const v=list('visible');assert.equal((v.html.match(/data-companion="/g)||[]).length,all-hidden,'the current companion is visible, so only visible ones are listed');
 const h=list('hidden');assert.equal((h.html.match(/data-companion="/g)||[]).length,hidden+1,'hidden ones plus the current companion');
 assert.match(h.html,new RegExp('data-companion="'+h.current+'"'));
 r.run("render()");assert.match(r.elements.get('app').innerHTML,/data-companion-filter="hidden"/);assert.deepEqual(r.errors,[]);
});
