const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loadRuntime}=require('./headless-editor.cjs');
test('editor job selector persists all five choices and preserves token settings on round-trip',()=>{
 const r=loadRuntime(process.cwd());r.ctx.published=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json'));
 r.run("data=__EMBERWILD_VALIDATE_DOCUMENT(published);ensureArrays();currentSection='companionTokens';render();");
 const app=r.elements.get('app'),field=r.ctx.document.createElement('select');field.dataset.tokenField='catalog.0.job';field.type='select-one';
 app.querySelectorAll=selector=>selector==='[data-token-field]'?[field]:[];
 for(const job of ['all','0','1','2','3']){r.run('render()');field.value=job;field.onchange();assert.equal(r.run('data.companionTokens.catalog[0].job'),job);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(__EMBERWILD_RELEASE_EDITOR.current());ensureArrays();');assert.equal(r.run('data.companionTokens.catalog[0].job'),job);}
 assert.match(app.innerHTML,/適用職業/);for(const name of ['通用','戰士','法師','弓箭手','牧師'])assert(app.innerHTML.includes(name));assert.deepEqual(r.errors,[]);
});
