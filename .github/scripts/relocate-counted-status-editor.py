from pathlib import Path
p=Path('balance-editor.html')
t=p.read_text(encoding='utf-8')
script_open='<script id="counted-status-targeting-editor-extension">'
inner_marker='/* Advanced reusable status mechanics: counted uses, stacking, ranked targets and damage spread. */'
anchor='globalThis.__EMBERWILD_STATUS_EDITOR_TEST_API={schema:STATUS_SCHEMA_VERSION,normalize:normalizeStatusDefinition,validate:validateStatusDefinition,selfTest:statusPureSelfTest,get definitions(){return deepCloneStatus(statusList());}};'
if script_open in t:
    a=t.index(script_open)
    js_start=t.index('>',a)+1
    b=t.index('</script>',js_start)
    js=t[js_start:b].strip()
    end=b+len('</script>')
    t=t[:a]+t[end:]
    if inner_marker not in t:
        if anchor not in t: raise SystemExit('status editor scope anchor not found')
        t=t.replace(anchor,js+'\n\n'+anchor,1)
elif inner_marker not in t:
    raise SystemExit('advanced status editor code not found')
p.write_text(t,encoding='utf-8')
