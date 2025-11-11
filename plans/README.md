# QoL Userscripts - Implementation Plans

This directory contains detailed implementation plans for quality-of-life userscripts.

## Available Plans

### 1. Dark Mode Toggle
**File:** `dark-mode-toggle-plan.md`

Hybrid dark mode implementation with smart CSS injection and filter fallback. Features per-site overrides, auto-detection of existing dark modes, and customizable color schemes.

**Key Features:**
- Smart CSS injection with quality dark theme
- CSS filter fallback for complex sites
- Per-site override system
- Auto-detect native dark modes
- Customizable colors and hotkeys

### 2. Custom Shortcuts Manager
**File:** `custom-shortcuts-manager-plan.md`

Full macro system with recording capability, common actions library, and custom JavaScript execution. Supports sequence shortcuts and conflict detection.

**Key Features:**
- Multi-key and sequence shortcuts
- Macro recording with visual feedback
- Built-in action library (scroll, click, navigate, etc.)
- Custom JavaScript execution
- Import/export shortcuts
- Conflict detection

### 3. Element Hider & Focus Mode
**File:** `element-hider-focus-plan.md`

Unified userscript with dual modes: permanently hide elements per-site, or temporarily focus on content with dimmed surroundings.

**Key Features:**
- Hide Mode: Permanently hide elements with undo
- Focus Mode: Dim/blur non-focused content
- Shared element selection system
- Per-site persistence
- Import/export hide rules
- Arrow key navigation

## Design Philosophy

All userscripts follow these principles:

1. **Consistent UI/UX:** Match the markdown-converter aesthetic
   - Dark theme (`#0b1220` background, `#e5e7eb` text)
   - Floating toolbar (bottom-left)
   - Settings modal with smooth animations
   - Toast notifications for feedback

2. **Keyboard-First:** Every action has a keyboard shortcut
   - Configurable hotkeys
   - Arrow key navigation
   - Vim-style sequences where appropriate

3. **Per-Site Intelligence:** Remember preferences per domain
   - Site-specific settings
   - Persistent storage using GM_getValue/GM_setValue
   - Import/export for backup

4. **Performance:** Optimized for minimal impact
   - Debounced event handlers
   - MutationObserver for dynamic content
   - Efficient CSS injection

5. **User Control:** Extensive customization options
   - Settings modal for all preferences
   - Visual feedback for all actions
   - Undo/redo where applicable

## Implementation Order

Recommended implementation order based on complexity:

1. **Element Hider & Focus Mode** (Simplest)
   - Builds on markdown-converter selection logic
   - Good foundation for understanding the codebase

2. **Dark Mode Toggle** (Medium)
   - CSS manipulation and site detection
   - Per-site override system

3. **Custom Shortcuts Manager** (Most Complex)
   - Event handling and macro recording
   - Action execution system
   - Conflict detection

## Shared Components

All userscripts share these common patterns:

- Settings system with load/save
- Floating toolbar component
- Settings modal with form handling
- Toast notification system
- Hotkey parser and matcher
- GM_addStyle for consistent styling
- Element selection with arrow key navigation (where applicable)

## Next Steps

1. Review individual plan files for detailed specifications
2. Choose a userscript to implement
3. Follow the implementation steps in each plan
4. Test thoroughly across different websites
5. Iterate based on real-world usage

## Notes

- All plans use GM API (Greasemonkey/Tampermonkey compatible)
- Storage uses GM_getValue/GM_setValue for persistence
- Import/export uses JSON format for portability
- All userscripts are standalone (no dependencies between them)
