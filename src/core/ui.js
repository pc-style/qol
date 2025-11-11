// unified UI components: toolbar, modal, toasts

import { escapeHtml, ready } from './utils.js';
import { STYLES } from '../styles.js';

const state = {
  toolbar: null,
  modal: null,
  mask: null,
  toast: null,
  toastTimer: null,
  scripts: new Map(), // scriptId -> config
  currentScriptTab: null
};

// inject styles
let styleInjected = false;
function ensureStyles() {
  if (styleInjected) return;
  GM_addStyle(STYLES);
  styleInjected = true;
}

// Toolbar
export const Toolbar = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
      this.update();
    });
  },

  ensure() {
    if (state.toolbar || !document.body) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'qol-toolbar';
    toolbar.dataset.qolUi = 'toolbar';
    document.body.appendChild(toolbar);
    state.toolbar = toolbar;
  },

  update() {
    if (!state.toolbar) return;
    const scripts = Array.from(state.scripts.values());
    
    if (scripts.length === 0) {
      state.toolbar.innerHTML = '<div class="qol-empty">No scripts registered</div>';
      return;
    }

    const buttons = scripts.map(script => {
      const enabled = script.enabled !== false;
      return `
        <button 
          type="button" 
          class="${enabled ? 'qol-active' : ''}" 
          data-script-id="${escapeHtml(script.id)}"
          title="${escapeHtml(script.name)}: ${escapeHtml(script.description || '')}"
        >
          ${escapeHtml(script.name)}
        </button>
      `;
    }).join('');

    const settingsBtn = '<button type="button" data-act="settings" title="Settings">⚙</button>';
    
    state.toolbar.innerHTML = buttons + settingsBtn;
    
    // attach click handlers
    state.toolbar.addEventListener('click', (e) => {
      const scriptBtn = e.target.closest('button[data-script-id]');
      const settingsBtn = e.target.closest('button[data-act="settings"]');
      
      if (scriptBtn) {
        const scriptId = scriptBtn.dataset.scriptId;
        const script = state.scripts.get(scriptId);
        if (script) {
          script.enabled = !script.enabled;
          script.onToggle?.(script.enabled);
          this.update();
        }
      } else if (settingsBtn) {
        Modal.open();
      }
    });
  },

  registerScript(script) {
    state.scripts.set(script.id, script);
    this.update();
  },

  unregisterScript(scriptId) {
    state.scripts.delete(scriptId);
    this.update();
  }
};

// Modal
export const Modal = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
    });
  },

  ensure() {
    if (state.modal || !document.body) return;
    
    // mask
    const mask = document.createElement('div');
    mask.id = 'qol-mask';
    mask.dataset.qolUi = 'mask';
    mask.addEventListener('click', () => this.close());
    
    // modal
    const modal = document.createElement('div');
    modal.id = 'qol-modal';
    modal.dataset.qolUi = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    
    document.body.appendChild(mask);
    document.body.appendChild(modal);
    
    state.mask = mask;
    state.modal = modal;
  },

  open(scriptId = null) {
    this.ensure();
    if (!state.modal) return;
    
    if (scriptId) {
      state.currentScriptTab = scriptId;
    } else {
      // default to first script or settings
      const scripts = Array.from(state.scripts.values());
      state.currentScriptTab = scripts.length > 0 ? scripts[0].id : null;
    }
    
    this.render();
    
    if (state.mask) state.mask.classList.add('show');
    if (state.modal) {
      state.modal.classList.add('show');
      // focus first input if any
      const firstInput = state.modal.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }
  },

  close() {
    if (state.mask) state.mask.classList.remove('show');
    if (state.modal) state.modal.classList.remove('show');
    state.currentScriptTab = null;
  },

  render() {
    if (!state.modal) return;
    
    const scripts = Array.from(state.scripts.values());
    
    // build tabs
    const tabs = scripts.map(script => {
      const active = script.id === state.currentScriptTab ? 'active' : '';
      return `
        <button 
          type="button" 
          class="qol-tab ${active}" 
          data-tab="${escapeHtml(script.id)}"
        >
          ${escapeHtml(script.name)}
        </button>
      `;
    }).join('');
    
    // build content for current script
    let content = '';
    if (state.currentScriptTab) {
      const script = state.scripts.get(state.currentScriptTab);
      if (script) {
        content = this.renderScriptSettings(script);
      }
    }
    
    state.modal.innerHTML = `
      <div class="qol-modal-header">
        <div>
          <h2>QoL Scripts Settings</h2>
          <p>Configure your quality of life enhancements</p>
        </div>
        <button type="button" class="qol-close-btn" data-close aria-label="Close">&times;</button>
      </div>
      <div class="qol-modal-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--qol-border-soft); padding-bottom: 8px;">
        ${tabs}
      </div>
      <div class="qol-modal-body">
        ${content || '<p style="color: var(--qol-text-soft);">Select a script to configure</p>'}
      </div>
    `;
    
    // attach handlers
    state.modal.querySelectorAll('.qol-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.currentScriptTab = tab.dataset.tab;
        this.render();
      });
    });
    
    state.modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // attach form submit handlers
    const forms = state.modal.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit(form);
      });
    });
  },

  renderScriptSettings(script) {
    if (!script.settings || Object.keys(script.settings).length === 0) {
      return `
        <div class="qol-script-section">
          <h3>${escapeHtml(script.name)}</h3>
          <p style="color: var(--qol-text-soft);">No settings available for this script.</p>
        </div>
      `;
    }
    
    const fields = Object.entries(script.settings).map(([key, schema]) => {
      const value = script.getSetting?.(key) ?? schema.default;
      const label = schema.label || key;
      
      if (schema.type === 'toggle') {
        return `
          <div class="qol-form-group row">
            <label>
              <input type="checkbox" name="${escapeHtml(key)}" ${value ? 'checked' : ''} />
              <span>${escapeHtml(label)}</span>
            </label>
          </div>
        `;
      } else if (schema.type === 'text') {
        return `
          <div class="qol-form-group">
            <label>${escapeHtml(label)}</label>
            <input type="text" name="${escapeHtml(key)}" value="${escapeHtml(String(value || ''))}" placeholder="${escapeHtml(schema.placeholder || '')}" />
          </div>
        `;
      } else if (schema.type === 'textarea') {
        return `
          <div class="qol-form-group">
            <label>${escapeHtml(label)}</label>
            <textarea name="${escapeHtml(key)}" placeholder="${escapeHtml(schema.placeholder || '')}">${escapeHtml(String(value || ''))}</textarea>
          </div>
        `;
      } else if (schema.type === 'select') {
        const options = (schema.options || []).map(opt => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          const selected = optValue === value ? 'selected' : '';
          return `<option value="${escapeHtml(optValue)}" ${selected}>${escapeHtml(optLabel)}</option>`;
        }).join('');
        return `
          <div class="qol-form-group">
            <label>${escapeHtml(label)}</label>
            <select name="${escapeHtml(key)}">${options}</select>
          </div>
        `;
      } else if (schema.type === 'color') {
        return `
          <div class="qol-form-group">
            <label>${escapeHtml(label)}</label>
            <input type="color" name="${escapeHtml(key)}" value="${escapeHtml(String(value || '#6366f1'))}" />
          </div>
        `;
      }
      return '';
    }).join('');
    
    return `
      <form data-script-id="${escapeHtml(script.id)}">
        <div class="qol-script-section">
          <h3>${escapeHtml(script.name)}</h3>
          <p style="color: var(--qol-text-soft); margin-bottom: 16px;">${escapeHtml(script.description || '')}</p>
          ${fields}
          <div class="qol-actions">
            <button type="submit" class="primary">Save</button>
            <button type="button" data-close>Cancel</button>
          </div>
        </div>
      </form>
    `;
  },

  handleFormSubmit(form) {
    const scriptId = form.dataset.scriptId;
    const script = state.scripts.get(scriptId);
    if (!script) return;
    
    const formData = new FormData(form);
    const settings = {};
    
    for (const [key, schema] of Object.entries(script.settings || {})) {
      if (schema.type === 'toggle') {
        settings[key] = formData.has(key);
      } else {
        settings[key] = formData.get(key) || schema.default;
      }
    }
    
    // save via script's setSetting if available
    if (script.setSettings) {
      script.setSettings(settings);
    } else {
      // fallback: save each key individually
      for (const [key, value] of Object.entries(settings)) {
        script.setSetting?.(key, value);
      }
    }
    
    Toast.show('Settings saved');
    this.close();
  }
};

// Toast
export const Toast = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
    });
  },

  ensure() {
    if (state.toast || !document.body) return;
    const toast = document.createElement('div');
    toast.id = 'qol-toast';
    toast.dataset.qolUi = 'toast';
    document.body.appendChild(toast);
    state.toast = toast;
  },

  show(message, duration = 2400) {
    this.ensure();
    if (!state.toast) return;
    
    state.toast.textContent = message;
    state.toast.classList.add('show');
    
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      if (state.toast) {
        state.toast.classList.remove('show');
      }
    }, duration);
  }
};

// export unified UI object
export const UI = {
  Toolbar,
  Modal,
  Toast,
  
  init() {
    Toolbar.init();
    Modal.init();
    Toast.init();
  },
  
  registerScript(script) {
    Toolbar.registerScript(script);
  },
  
  unregisterScript(scriptId) {
    Toolbar.unregisterScript(scriptId);
  }
};

