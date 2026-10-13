/* Only pending review tickets live here. GitHub remains the version database. */
export class D1TicketStore{
 constructor(db){if(!db)throw Object.assign(Error('發布摘要儲存尚未配置'),{status:503});this.db=db;}
 async set(id,value){const stored={...value,target:{branch:value.target.branch,commit:value.target.commit,blob:value.target.blob}},json=JSON.stringify(stored);if(new TextEncoder().encode(json).length>1500000)throw Error('此發布資料過大，超過線上摘要儲存上限');await this.db.prepare('INSERT INTO release_tickets (id, owner, expires, state, payload) VALUES (?, ?, ?, ?, ?)').bind(id,value.session,value.expires,'prepared',json).run();}
 async get(id){const row=await this.db.prepare('SELECT payload FROM release_tickets WHERE id = ? AND state = ?').bind(id,'prepared').first();return row?JSON.parse(row.payload):null;}
 async take(id,owner){const out=await this.db.prepare('UPDATE release_tickets SET state = ? WHERE id = ? AND owner = ? AND state = ? AND expires > ?').bind('consumed',id,owner,'prepared',Date.now()).run();return out.meta.changes===1;}
 async prune(){await this.db.prepare('DELETE FROM release_tickets WHERE id IN (SELECT id FROM release_tickets WHERE expires < ? LIMIT 100)').bind(Date.now()-86400000).run();}
}
