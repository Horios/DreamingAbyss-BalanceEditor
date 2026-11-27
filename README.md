# 夢淵 平衡器

## 即時平衡器（建議使用）

`npm run live` 後開啟 http://localhost:8787/ ，在遊戲畫面上直接修改文字、道具、技能、夥伴等全部設定，並一鍵匯出完整 JSON。說明見 [live-editor/README.md](live-editor/README.md)。

---

# Sites Worker ESM starter

Use this starter for a static microsite, click counter, or simple internal UI whose state is browser-scoped. It has no dependencies and needs no install.

Edit `worker/index.js`, then publish through the Sites hosting workflow with this starter's build and validation in `commands`.

The build copies only `worker/index.js` and `.openai/hosting.json`. Do not add standalone asset files. Embed any essential raster bytes in `worker/index.js` and serve or reference them as a data URL.

Pass these argument arrays as `commands`:

```json
[
  ["bash", "scripts/build.sh"],
  ["node", "scripts/validate-artifact.mjs"]
]
```

The deterministic build produces:

```text
dist/
├── .openai/
│   └── hosting.json
└── server/
    └── index.js
```

`dist/server/index.js` is an ES module with a default export containing `fetch(request, env, ctx)`. Edit `worker/index.js`, not the generated file under `dist/`.

## Skill system v1 compatibility

The canonical skill/equipment/gem editor requires the game runtime capability
`skillSystemVersion:1`. Its compiled validator is pinned to game commit
`de20dfc3adc6850a3cbd2ccc0204b9a42ad5c2a2` on `chatgpt-dev`.
The old positional skill arrays are derived adapters; edit canonical definitions
in **技能、裝備與寶石**. Class, equipment socket/pool and gem rules use validated
JSON controls. Existing GitHub publish/restore operations reject new documents
when the destination runtime does not advertise that capability.

Validation: the 79-test workbench run passed 78 tests. One pre-existing starter
pack editor test still expects a single weapon entry although the existing
editor expands imported starter packs to five equipment positions. That
unrelated starter editor behavior was not redesigned in this change. The new
skill editor, runtime validation and publication compatibility tests pass.
