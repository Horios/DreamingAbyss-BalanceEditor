import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs'),published=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json'));
function editor(doc=published){const r=loadRuntime(process.cwd());r.ctx.doc=doc;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();__EMBERWILD_INVENTORY_ICON_EDITOR.open();');return r;}
test('category hierarchy is nested, counted from regular items and collapses without rebuilding the catalogue',()=>{
 const r=editor(),E=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR,before=r.run('JSON.stringify(data)'),metrics=E.diagnostics;
 let html=r.elements.get('catalogueCategories').innerHTML;assert.match(html,/class="catalogue-tree"/);assert.match(html,/data-catalogue-expand=/);assert.match(html,/aria-controls="category-children-/);assert.match(html,/<ul id="category-children-/);assert.match(html,/catalogue-tree-count">343/);
 assert.equal(r.run('count("inventoryIcons")'),343);assert.equal(E.query().length,343);assert(!E.query().some(x=>x.key==='level_scroll'));
 E.toggleCategory(['消耗品']);html=r.elements.get('catalogueCategories').innerHTML;assert.match(html,/aria-label="展開消耗品"/);assert.equal(E.diagnostics.indexBuilds,metrics.indexBuilds);assert.equal(E.diagnostics.listBuilds,metrics.listBuilds);assert.equal(E.diagnostics.detailBuilds,metrics.detailBuilds);assert.equal(r.run('JSON.stringify(data)'),before);
 E.toggleCategory(['消耗品']);assert.match(r.elements.get('catalogueCategories').innerHTML,/aria-label="收合消耗品"/);assert.deepEqual(r.errors,[]);
});
test('built-in scroll is opt-in, clearly labelled, editable, and never counted as a regular definition',()=>{
 const r=editor(),E=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR,original=r.run('JSON.stringify(data)');
 r.ctx.document.getElementById('catalogueShowSystemItems').onchange({target:{checked:true}});assert.equal(E.query().length,344);assert.equal(r.run('count("inventoryIcons")'),343);assert.equal(E.entries().find(x=>x.key==='level_scroll').systemItem,true);
 E.select('item:level_scroll');E.selectTab('basic');assert.match(r.elements.get('catalogueDetail').innerHTML,/沒有一般道具定義，不計入道具數量/);assert.equal(r.run('JSON.stringify(data)'),original);
 E.stage('item:level_scroll','description','內建卷軸說明');E.save();const out=r.run('__EMBERWILD_RELEASE_EDITOR.current()');assert.equal(out.inventoryIcons.find(x=>x.key==='level_scroll').description,'內建卷軸說明');assert(!out.items.some(x=>x.id==='level_scroll'));
 // Expansion replaces sidebar DOM but the opt-in control remains functional.
 E.toggleCategory(['消耗品']);r.ctx.document.getElementById('catalogueShowSystemItems').onchange({target:{checked:false}});assert(!E.query().some(x=>x.key==='level_scroll'));assert.equal(r.run('count("inventoryIcons")'),343);assert.deepEqual(r.errors,[]);
});
test('an explicitly defined level scroll is a regular item instead of a synthetic system entry',()=>{
 const doc=structuredClone(published);doc.items.push({...doc.items.find(x=>x.id==='heal_small'),id:'level_scroll',name:'升級卷軸',description:'已建立道具'});
 const r=editor(doc),E=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR;assert.equal(E.entries().find(x=>x.key==='level_scroll').systemItem,false);assert.equal(r.run('count("inventoryIcons")'),344);assert(E.query().some(x=>x.key==='level_scroll'));assert.deepEqual(r.errors,[]);
});
