import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {createGameValidator} from '../server/online/game-validator.mjs';
const defaults=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json','utf8'));
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
test('item, crafted material, recipe input, gem and token choices survive editor export and game validation',()=>{
 const r=loadRuntime(process.cwd()),v=createGameValidator();r.ctx.doc=defaults;r.run('data=structuredClone(doc);');
 const entries=JSON.parse(r.run('JSON.stringify(__EMBERWILD_INVENTORY_ICON_EDITOR.entries())'));
 const pairs=[['item',defaults.items[0].id],['material','以太鍛鐵'],['material','光輝碎塊'],['gem','0'],['token',defaults.companionTokens.catalog[0].id]];
 for(const [kind,key]of pairs){r.ctx.args={kind,key};r.run('__EMBERWILD_INVENTORY_ICON_EDITOR.set(args.kind,args.key,"lucide:leaf")');}
 const exported=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())'));assert.equal(exported.inventoryIcons.length,defaults.inventoryIcons.length);for(const [kind,key] of pairs)assert.equal(exported.inventoryIcons.find(x=>x.kind===kind&&String(x.key)===key).iconType,'lucide:leaf');assert.deepEqual(v.validate(exported).inventoryIcons,exported.inventoryIcons);
 r.run('currentSection="inventoryIcons";render();');r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR.selectTab('appearance');assert.match(r.elements.get('catalogueDetail').innerHTML,/Lucide 圖庫/);r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR.filter({search:'光輝碎塊'});assert.match(r.elements.get('catalogueList').innerHTML,/光輝碎塊/);r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR.filter({search:''});
 r.run('currentSection="materialPrices";render();');assert.match(r.elements.get('app').innerHTML,/openGlobalItems/);assert(!r.elements.get('app').innerHTML.includes('data-choose-inventory-icon'));
 for(const [kind,key]of pairs){r.ctx.args={kind,key};r.run('__EMBERWILD_INVENTORY_ICON_EDITOR.set(args.kind,args.key,"auto")');}const reset=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport().inventoryIcons)'));for(const [kind,key] of pairs)assert.equal(reset.find(x=>x.kind===kind&&String(x.key)===key)?.iconType,'auto');assert.deepEqual(r.errors,[]);
});
test('shared editor model matches the engine contract and rejects an unknown library reference',()=>{
 const r=loadRuntime(process.cwd());r.run('data.inventoryIcons=[{kind:"material",key:"以太鍛鐵",iconType:"lucide:missing-fixture"}]');assert(r.run('validateData()').some(x=>x.includes('道具圖示')));
 const html=fs.readFileSync('balance-editor.html','utf8'),source=html.match(/<script id="inventory-icon-model-v1">\s*([\s\S]*?)<\/script>/)[1].trim();assert(fs.readFileSync('server/online/game-validator.mjs','utf8').includes(source));
});
test('color-only custom icons keep default layer tones JSON-safe through validation, release preparation and reload',async()=>{
 const r=loadRuntime(process.cwd()),v=createGameValidator();r.ctx.doc=defaults;
 r.run(`data=structuredClone(doc);data.skillIcons=[['leaf','#21a844'],['blue_leaf','#459ded'],['red_paste','#c74b54']].map(([id,color])=>({id,name:id,layers:[__EMBERWILD_SKILL_ICONS.normalizeLayer({kind:'icon',icon:'lucide:leaf',x:0,y:0,scale:1,rotation:0})],appearance:__EMBERWILD_SKILL_ICONS.normalizeAppearance({color})}));ensureArrays();__EMBERWILD_INVENTORY_ICON_EDITOR.set('material','以太鍛鐵','custom:leaf');`);
 // Use the in-memory document directly: JSON.stringify would hide the original undefined-tone bug.
 const exported=r.run('__EMBERWILD_RELEASE_EDITOR.current()');assert.doesNotThrow(()=>r.ctx.__EMBERWILD_VALIDATE_DOCUMENT(exported));assert.doesNotThrow(()=>v.validate(exported));assert.equal(Object.hasOwn(exported.skillIcons[0].layers[0],'tone'),false);
 assert.deepEqual(Array.from(exported.skillIcons,x=>x.appearance.color),['#21a844','#459ded','#c74b54']);
 r.ctx.location.protocol='https:';let prepared=0;r.ctx.fetch=async(url,opts={})=>{const body=opts.body?JSON.parse(opts.body):{};let value;if(url==='/api/session')value={csrf:'fixture'};else if(url==='/api/snapshot')value={branch:'chatgpt-dev',commit:'a'.repeat(40),data:defaults};else if(url==='/api/prepare'){v.validate(body.data);assert.equal(body.data.skillIcons[1].appearance.color,'#459ded');prepared++;value={ticket:'color-fixture',branch:'chatgpt-dev',message:body.message,diff:{rows:[],total:0},currentVersion:'a',nextVersion:'b'};}else throw Error('Unexpected API '+url);return {ok:true,json:async()=>value};};
 r.run('currentSection="releases";__EMBERWILD_RELEASE_EDITOR.state.message="修改素材圖示顏色";render();');await r.ctx.document.getElementById('releasePreview').onclick();assert.equal(prepared,1);assert.equal(r.ctx.__EMBERWILD_RELEASE_EDITOR.state.prepared.ticket,'color-fixture');assert.equal(r.ctx.__EMBERWILD_RELEASE_EDITOR.state.feedbackKind,'success');
 r.ctx.reloaded=JSON.parse(JSON.stringify(exported));r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(reloaded);ensureArrays();');assert.equal(r.run('data.skillIcons[2].appearance.color'),'#c74b54');assert.doesNotThrow(()=>r.ctx.__EMBERWILD_VALIDATE_DOCUMENT(r.run('__EMBERWILD_RELEASE_EDITOR.current()')));
 // Validation still refuses non-JSON values in unrelated fields.
 const invalid=r.run('__EMBERWILD_RELEASE_EDITOR.current()');invalid.uiText.invalidFixture=undefined;assert.throws(()=>r.ctx.__EMBERWILD_VALIDATE_DOCUMENT(invalid),/不是合法 JSON/);assert.deepEqual(r.errors,[]);
});
test('each page has one scoped manager, color selection creates no custom icons, and detail edits use canonical fields',()=>{
 const r=loadRuntime(process.cwd()),v=createGameValidator();r.ctx.doc=defaults;r.run('data=structuredClone(doc);HTMLElement.prototype.addEventListener=function(type,handler){this["on"+type]=handler;};');
 const E=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR,before=r.run('data.skillIcons.length');
 for(const section of ['equipment','items','materialPrices']){r.ctx.section=section;r.run('currentSection=section;render();');assert.equal((r.elements.get('app').innerHTML.match(/id="openGlobalItems"/g)||[]).length,1);assert(!r.elements.get('app').innerHTML.includes('data-choose-inventory-icon'));assert.match(r.elements.get('app').innerHTML,/openGlobalItems/);E.open();E.selectTab('appearance');assert.match(r.elements.get('catalogueDetail').innerHTML,/inventoryIconColor/);assert(E.scope(section).length>0);}
 assert(E.entries().some(x=>x.id==='equipment:form:0:0:0'));assert(E.entries().some(x=>x.id==='equipment:boss:0:0'));assert(E.entries().some(x=>x.id==='material:以太鍛鐵'));assert(!E.entries().some(x=>x.id==='material:小蟲'));
 E.open('inventoryIcons','crafting','material:以太鍛鐵');E.selectTab('appearance');const color=r.ctx.document.getElementById('inventoryIconColor');color.value='#2244ff';r.ctx.document.getElementById('inventoryColorEnabled').onchange({target:{checked:true}});E.save();assert.equal(E.settings('material','以太鍛鐵').color,'#2244ff');assert.equal(r.run('data.skillIcons.length'),before);assert.match(r.elements.get('catalogueDetail').innerHTML,/#2244ff/);
 E.selectTab('basic');r.ctx.document.getElementById('managerDescription').onchange({target:{value:'以太製作素材'}});E.selectTab('economy');r.ctx.document.getElementById('managerSellPrice').onchange({target:{value:'9'}});E.save();assert.equal(E.settings('material','以太鍛鐵').description,'以太製作素材');assert.equal(r.run('data.balanceSettings.economy.materialPrices.find(x=>x.key==="以太鍛鐵").sellPrice'),9);
 // Switching to crafting shows the very same material setting; resetting color keeps its description.
 E.set('material','以太鍛鐵','lucide:leaf');assert.equal(E.settings('material','以太鍛鐵').color,'#2244ff');E.set('material','以太鍛鐵','auto',{color:undefined});assert.equal(E.settings('material','以太鍛鐵').color,undefined);assert.equal(E.settings('material','以太鍛鐵').description,'以太製作素材');
 const exported=r.run('__EMBERWILD_RELEASE_EDITOR.current()');assert.doesNotThrow(()=>v.validate(exported));assert.deepEqual(r.errors,[]);
});

