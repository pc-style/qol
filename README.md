# QoL Userscript Framework

A modular framework for building and managing multiple userscripts with unified UI, storage, and dependency management.

## Features

- **Unified UI**: Shared glassmorphic toolbar and settings modal
- **Per-script storage**: Namespaced settings using `QoL.store`
- **Dependency management**: Load and cache shared libraries (Turndown, Readability, etc.)
- **Hot-swappable**: Enable/disable scripts dynamically without reinstalling
- **Build tooling**: esbuild-based bundler with userscript header injection

## Project Structure

```
qol/
├── src/
│   ├── core/
│   │   ├── ui.js          # Toolbar, modal, toasts
│   │   ├── store.js       # Per-script persistent settings
│   │   ├── utils.js       # Shared helpers
│   │   ├── deps.js        # Dependency loader/cache
│   │   └── registry.js    # Auto-generated script manifest
│   ├── styles.js          # Dark glassmorphism CSS
│   └── index.js           # Main entry, exposes global QoL
├── scripts/
│   └── [*.user.js files]
├── tools/
│   ├── new-script.js      # Scaffold new scripts
│   ├── check-scripts.js   # Validate scripts
│   ├── integrate.js       # Regenerate registry
│   └── build.js           # esbuild bundler
└── dist/                  # Build output
```

## Usage

### Creating a New Script

```bash
npm run new:script
```

Follow the prompts to create a new script template.

### Registering a Script

```javascript
QoL.registerScript({
  id: 'my-script',
  name: 'My Script',
  description: 'Does something useful',
  version: '1.0.0',
  enabled: true,
  
  settings: {
    hotkey: { type: 'text', default: 'Alt+X', label: 'Hotkey' },
    enabled: { type: 'toggle', default: true, label: 'Enable' }
  },
  
  getSetting(key) {
    return QoL.store.get('my-script', key, this.settings[key].default);
  },
  
  setSetting(key, value) {
    QoL.store.set('my-script', key, value);
  },
  
  init() {
    // initialization logic
    return { /* instance state */ };
  },
  
  destroy(instance) {
    // cleanup logic
  }
});
```

### Using Framework APIs

#### Storage

```javascript
// Get a setting
const value = QoL.store.get('script-id', 'key', defaultValue);

// Set a setting
QoL.store.set('script-id', 'key', value);

// Get all settings for a script
const all = QoL.store.getAll('script-id');
```

#### Dependencies

```javascript
// Load a dependency (cached after first load)
const TurndownService = await QoL.deps.load('turndown');
const turndownPluginGfm = await QoL.deps.load('turndown-gfm');
const Readability = await QoL.deps.load('readability');
```

#### UI

```javascript
// Show a toast notification
QoL.ui.Toast.show('Message');

// Open settings modal
QoL.ui.Modal.open('script-id');
```

## Build Commands

```bash
# Validate all scripts
npm run check:scripts

# Regenerate registry
npm run integrate

# Build framework only
npm run build

# Build framework + all scripts
npm run build:all
```

## Settings Schema

Settings are defined with a schema that auto-generates form UI:

- `type: 'toggle'` - Checkbox
- `type: 'text'` - Text input
- `type: 'textarea'` - Multi-line text
- `type: 'select'` - Dropdown (requires `options` array)
- `type: 'color'` - Color picker

Each setting should have:
- `type` - Control type
- `default` - Default value
- `label` - Display label (optional)

## Migration Guide

To migrate an existing script:

1. Add `@require` pointing to framework
2. Replace `GM_getValue`/`GM_setValue` with `QoL.store`
3. Replace dependency `@require` with `QoL.deps.load()`
4. Replace custom toast with `QoL.ui.Toast.show()`
5. Wrap init logic in `init()` function
6. Add `destroy()` for cleanup
7. Call `QoL.registerScript()` with config

## License

MIT
