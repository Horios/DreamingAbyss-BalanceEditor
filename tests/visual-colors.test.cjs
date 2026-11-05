// Game v0.079 display colors: map battlefieldColor, monster cardColor, class cardColor are editable, validated,
// unchanged defaults are not written, and the game draws the edited colors.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../Emberwild/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../Emberwild'),plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const g=loadGame(game),doc=plain(g.run('exportableBalance()')),e=loadRuntime(root);e.ctx.input=doc;e.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');return e;}

test('the three colors are kept, validated, and saving an unchanged default writes nothing',async()=>{
 const e=editor(),W='__EMBERWILD_WORLD_EDITOR';e.run("currentSection='overview';render()");// the world page itself does not render in the headless DOM
 const map=plain(e.run(`${W}.maps()[0]`));assert.equal(map.battlefieldColor,map.color.toLowerCase(),'the form shows the map color as default');
 e.run(`${W}.update(0,{battlefieldColor:${JSON.stringify(map.battlefieldColor)}})`);assert.equal(e.run('data.balanceSettings.maps.catalog[0].battlefieldColor'),undefined,'an unchanged default is not stored');
 e.run(`${W}.update(0,{battlefieldColor:'#1A2B3C'})`);assert.equal(e.run('data.balanceSettings.maps.catalog[0].battlefieldColor'),'#1a2b3c');
 assert.throws(()=>e.run(`(()=>{const r=${W}.update(1,{battlefieldColor:'green'});if(r&&r.ok===false)throw Error(r.error);})()`),/戰場底色必須是 #RRGGBB/);
 const id=e.run('data.balanceSettings.monsters.catalog[0].id'),mon=plain(e.run(`${W}.monster(${JSON.stringify(id)})`));assert.match(mon.cardColor,/^#[0-9a-f]{6}$/);
 e.run(`${W}.updateMonster(${JSON.stringify(id)},{cardColor:${JSON.stringify(mon.cardColor)}})`);assert.equal(e.run('data.balanceSettings.monsters.catalog[0].cardColor'),undefined);
 e.run(`${W}.updateMonster(${JSON.stringify(id)},{cardColor:'#445566'})`);assert.equal(e.run('data.balanceSettings.monsters.catalog[0].cardColor'),'#445566');
 e.run("data.classes[0].cardColor='#abcdef';data.classes[1].cardColor='blue';markDirty('t')");
 assert(plain(e.run('validateData()')).some(x=>/職業「.*」卡片顏色必須是 #RRGGBB/.test(x)));e.run('data.classes[1].cardColor="#123123";markDirty("t")');
 assert.deepEqual(plain(e.run('validateData()')),[]);
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),out=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 assert.doesNotThrow(()=>createGameValidator().validate(out));
 const g=loadGame(game);g.ctx.input=out;g.run('applyBalanceConfig(input,{persist:false})');
 assert.equal(g.run('EmberwildVisualColors.battlefield(0)'),'#1a2b3c');assert.equal(g.run('EmberwildVisualColors.cls(0)'),'#abcdef');assert.equal(g.run('EmberwildVisualColors.cls(1)'),'#123123');
 assert.equal(g.run(`EmberwildVisualColors.monster({monsterId:${JSON.stringify(id)}})`),'#445566');
 assert.match(e.run("currentSection='classes';render();document.getElementById('app').innerHTML"),/戰鬥卡片顏色/);
 const src=require('node:fs').readFileSync(path.join(root,'balance-editor.html'),'utf8');
 assert.match(src,/<label>戰場底色<input type="color" class="world-map-field" data-key="battlefieldColor"/);assert.match(src,/<label>戰鬥卡片顏色<input type="color" class="world-monster-field" data-key="cardColor"/);
});
