Perfect! Now I have all the details needed. Let me create a comprehensive plan for your QoL userscript framework.

# Implementation Plan

## Project Structure
```
qol-userscripts/
├── src/
│   ├── core/
│   │   ├── ui.js          # Toolbar, modal, toasts (glassmorphism)
│   │   ├── store.js       # Per-script persistent settings
│   │   ├── utils.js       # Shared helpers
│   │   ├── deps.js        # Dependency loader/cache
│   │   └── registry.js    # Auto-generated script manifest
│   ├── styles.js          # Dark glassmorphism CSS
│   └── index.js           # Main entry, exposes global QoL
├── scripts/
│   └── [individual userscripts call QoL.registerScript()]
├── tools/
│   ├── new-script.js      # Scaffold new scripts
│   ├── check-scripts.js   # Validate scripts
│   ├── integrate.js       # Regenerate registry
│   └── build.js           # esbuild bundler
├── dist/                  # Build output
├── package.json
└── README.md
```

## Framework Core (`src/`)

### `QoL.ui`
- **Toolbar**: Fixed bottom-left glassmorphic toolbar showing registered scripts with toggle buttons
- **Modal**: Unified settings modal with tabs/sections per script, renders based on each script's settings schema
- **Toasts**: Notification system matching existing toast styling from dark-mode-toggle

### `QoL.store`
- Namespaced storage per script using `GM_getValue`/`GM_setValue`
- API: `QoL.store.get(scriptId, key)`, `QoL.store.set(scriptId, key, value)`

### `QoL.deps`
- Dependency cache for shared libraries (Turndown, Readability, etc.)
- API: [await QoL.deps.load('turndown')](cci:1://file:///Users/pcstyle/qol-userscripts/markdown-converter.user.js:50:6-56:7) returns cached or loads from CDN
- Prevents duplicate library loads across scripts

### `QoL.registerScript(config)`
- Registers script with: `{ id, name, description, version, enabled, settings: {...}, init: fn, destroy: fn }`
- Settings schema defines UI controls (toggle, text, color, select, etc.)
- Framework calls [init()](cci:1://file:///Users/pcstyle/qol-userscripts/custom-shortcuts-manager.user.js:2005:2-2017:3) when enabled, `destroy()` when disabled

## Styling
All UI components use your existing dark glassmorphism design:
- Background: `rgba(15, 23, 42, 0.9)` with `backdrop-filter: blur(12px)`
- Borders: `rgba(148, 163, 184, 0.35)`
- Accent: `#6366f1`
- Border radius: `14px` (toolbar), `18px` (modal)
- Gradients: `radial-gradient(circle at top, rgba(148,163,253,0.04), transparent)`

## Tooling (`tools/`)

### `npm run new:script -- <id>`
Creates `scripts/<id>.user.js` with:
- Userscript metadata headers
- `QoL.registerScript()` boilerplate
- Validates unique ID against existing scripts
- Prompts for name, description, default enabled state

### `npm run check:scripts`
Validates all files in `scripts/`:
- No duplicate IDs
- Required fields present (id, name, description)
- Valid JavaScript syntax
- Proper `QoL.registerScript()` call structure

### `npm run integrate`
Scans `scripts/` and regenerates `src/core/registry.js`:
- Exports array of all available scripts metadata
- Used by framework toolbar to show available scripts
- Auto-runs before build

### `npm run build` / `npm run build:all`
Uses esbuild to:
1. Bundle `src/` → `dist/qol-framework.user.js` with userscript headers and all `@grant` permissions
2. Bundle each `scripts/*.user.js` → `dist/` with `@require` pointing to framework
3. Minify and add source maps for debugging

## Migration Example
Convert [dark-mode-toggle.user.js](cci:7://file:///Users/pcstyle/qol-userscripts/dark-mode-toggle.user.js:0:0-0:0) to:
```javascript
QoL.registerScript({
  id: 'dark-mode-toggle',
  name: 'Dark Mode Toggle',
  description: 'Hybrid dark mode with smart CSS injection',
  version: '2.0.0',
  enabled: true,
  settings: {
    defaultMode: { type: 'select', options: ['smart', 'filter', 'off'], default: 'smart' },
    hotkey: { type: 'text', default: 'Alt+D' },
    // ... other settings
  },
  init() { /* existing logic */ },
  destroy() { /* cleanup */ }
});
```

## Key Features
- **Modular**: Core framework + independent scripts
- **Consistent UI**: All scripts share glassmorphic toolbar and settings modal
- **Easy workflow**: `new:script` → code → `check:scripts` → `build`
- **Dependency sharing**: Common libraries loaded once via `QoL.deps`
- **Per-script settings**: Each script declares schema, framework renders UI
- **Hot-swappable**: Enable/disable scripts from unified settings without reinstalling

This plan creates a clean, extensible foundation matching your existing QoL aesthetic while providing robust tooling for managing multiple userscripts in one repo.