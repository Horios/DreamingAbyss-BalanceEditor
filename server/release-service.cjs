'use strict';
const crypto=require('node:crypto');
class ReleaseService{
 constructor({api,validate}){this.api=api;this.validateDocument=validate;this.base='/repos/Horios/Emberwild';}
 branch(value){if(!['main','chatgpt-dev'].includes(value))throw Error('僅允許 main／chatgpt-dev');return value;}
 async validate({data}){return {data:this.validateDocument(data),valid:true};}
 async snapshot({branch,ref}){
  branch=this.branch(branch);if(ref&&!/^[a-f0-9]{40}$/.test(ref))throw Error('commit SHA 格式錯誤');
  const head=await this.api(this.base+'/git/ref/heads/'+branch),commit=ref||head.object.sha;
  const f=await this.api(this.base+'/contents/data/balance.json?ref='+commit);
  if(f.type!=='file'||f.encoding!=='base64')throw Error('JSON 檔案格式無效');
  let data;try{data=JSON.parse(Buffer.from(f.content.replace(/\s/g,''),'base64').toString('utf8'));}catch{throw Error('線上 JSON 無法解析');}
  return {branch,commit,head:head.object.sha,blob:f.sha,data};
 }
}
module.exports={ReleaseService};
