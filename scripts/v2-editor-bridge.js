/* The V2 game shell calls the existing editor; it owns no second document. */
(()=>{'use strict';globalThis.__EMBERWILD_V2_BRIDGE=Object.freeze({
 open(section){if(!SECTION_META.some(row=>row[0]===section))throw Error('找不到設定頁面：'+section);currentSection=section;render();},
 current(){return __EMBERWILD_RELEASE_EDITOR.current();},
 validate(doc){return __EMBERWILD_VALIDATE_DOCUMENT(doc);}
});})();
