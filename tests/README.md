# QoL Scripts Test Page

Comprehensive test page for testing all QoL userscripts.

## Usage

Open `index.html` in your browser (or serve it via a local server) and test each script.

## Test Sections

### 🌙 Dark Mode Toggle Tests

**Hotkey:** `Ctrl+D`

Tests:
- ✅ Light/dark background elements
- ✅ Form inputs (text, email, textarea, select)
- ✅ Buttons and interactive elements
- ✅ Images and media
- ✅ Code blocks
- ✅ Tables
- ✅ Native dark mode detection (section with dark styling)
- ✅ Shadow DOM compatibility
- ✅ Iframe synchronization
- ✅ Complex nested content with multiple background layers

**Modes to test:**
- Smart mode (CSS injection)
- Filter mode (CSS filter fallback)
- Per-site overrides

### 📝 Markdown Converter Tests

**Hotkey:** `Ctrl+M` (default)

Tests:
- ✅ Article content extraction
- ✅ Headings (h1-h6)
- ✅ Lists (ordered and unordered)
- ✅ Links (internal and external)
- ✅ Code blocks and inline code
- ✅ Blockquotes
- ✅ Tables
- ✅ Readability mode extraction
- ✅ Various formatting (bold, italic, highlights)

**Workflow:**
1. Press `Ctrl+M` to activate selector mode
2. Use arrow keys to navigate DOM elements
3. Click to copy selection as Markdown
4. Press `R` for Readability mode

### ⌨️ Custom Shortcuts Tests

**Hotkey:** `Alt+K` (default for manager)

Tests:
- ✅ Form input manipulation
- ✅ Button clicks
- ✅ Page navigation (scroll, reload)
- ✅ Content manipulation (font size, visibility)
- ✅ Recording sequences
- ✅ Per-site shortcuts

**Workflow:**
1. Open shortcuts manager (`Alt+K`)
2. Record a sequence of actions
3. Assign a hotkey
4. Test playback

## Test Features

- **Shadow DOM:** Tests dark mode compatibility with shadow DOM
- **Iframes:** Tests iframe synchronization
- **Complex nesting:** Multiple layers of backgrounds and containers
- **Native dark mode hint:** Section styled dark to test auto-detection
- **Various content types:** Articles, forms, tables, code, images

## Running Tests

1. **Local file:** Open `index.html` directly in browser
2. **Local server:** 
   ```bash
   cd tests
   python3 -m http.server 8000
   # Then visit http://localhost:8000
   ```
3. **Or serve via any static file server**

## Notes

- All scripts should work independently
- Test each script's enable/disable functionality
- Check console for any errors (F12)
- Test hotkey conflicts
- Verify settings persistence

