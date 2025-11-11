// main entry point - exposes global QoL object

import { Store } from './core/store.js';
import { UI } from './core/ui.js';
import { Deps } from './core/deps.js';
import { ready } from './core/utils.js';
import { REGISTRY } from './core/registry.js';

const scripts = new Map(); // scriptId -> { config, instance }

// initialize framework
function init() {
  UI.init();
  
  // register scripts from registry
  for (const scriptMeta of REGISTRY) {
    // scripts will register themselves via QoL.registerScript()
    // registry is just for metadata display
  }
}

// register a script
function registerScript(config) {
  const {
    id,
    name,
    description,
    version = '1.0.0',
    enabled = true,
    settings = {},
    init: initFn,
    destroy: destroyFn
  } = config;

  if (!id || !name) {
    console.error('[QoL] Script registration failed: id and name are required');
    return;
  }

  if (scripts.has(id)) {
    console.warn(`[QoL] Script ${id} is already registered, replacing...`);
    // cleanup old instance
    const old = scripts.get(id);
    if (old.instance && old.config.destroy) {
      try {
        old.config.destroy(old.instance);
      } catch (e) {
        console.error(`[QoL] Error destroying script ${id}:`, e);
      }
    }
  }

  // create script instance with store wrapper
  const scriptInstance = {
    id,
    name,
    description,
    version,
    enabled: Store.get(id, 'enabled', enabled),
    settings,
    
    // store helpers
    getSetting(key) {
      const schema = settings[key];
      if (!schema) return undefined;
      return Store.get(id, key, schema.default);
    },
    
    setSetting(key, value) {
      Store.set(id, key, value);
      // update local enabled state if it's the enabled key
      if (key === 'enabled') {
        this.enabled = value;
      }
    },
    
    setSettings(newSettings) {
      for (const [key, value] of Object.entries(newSettings)) {
        this.setSetting(key, value);
      }
    },
    
    // lifecycle
    init: initFn,
    destroy: destroyFn,
    
    // toggle handler
    onToggle(enabled) {
      this.enabled = enabled;
      Store.set(id, 'enabled', enabled);
      
      if (enabled) {
        // initialize script
        if (this.init && !this.instance) {
          try {
            this.instance = this.init();
          } catch (e) {
            console.error(`[QoL] Error initializing script ${id}:`, e);
            this.enabled = false;
            Store.set(id, 'enabled', false);
          }
        }
      } else {
        // destroy script
        if (this.destroy && this.instance) {
          try {
            this.destroy(this.instance);
            this.instance = null;
          } catch (e) {
            console.error(`[QoL] Error destroying script ${id}:`, e);
          }
        }
      }
    }
  };

  scripts.set(id, {
    config: scriptInstance,
    instance: null
  });

  // register with UI
  UI.registerScript(scriptInstance);

  // initialize if enabled
  if (scriptInstance.enabled && initFn) {
    ready(() => {
      try {
        scriptInstance.instance = initFn();
      } catch (e) {
        console.error(`[QoL] Error initializing script ${id}:`, e);
        scriptInstance.enabled = false;
        Store.set(id, 'enabled', false);
        UI.Toolbar.update();
      }
    });
  }

  return scriptInstance;
}

// unregister a script
function unregisterScript(scriptId) {
  const script = scripts.get(scriptId);
  if (!script) return;

  // destroy instance
  if (script.instance && script.config.destroy) {
    try {
      script.config.destroy(script.instance);
    } catch (e) {
      console.error(`[QoL] Error destroying script ${scriptId}:`, e);
    }
  }

  scripts.delete(scriptId);
  UI.unregisterScript(scriptId);
}

// get registered script
function getScript(scriptId) {
  const script = scripts.get(scriptId);
  return script ? script.config : null;
}

// expose global QoL object
const QoL = {
  registerScript,
  unregisterScript,
  getScript,
  store: Store,
  ui: UI,
  deps: Deps
};

// expose globally
if (typeof window !== 'undefined') {
  window.QoL = QoL;
}

// initialize when DOM is ready
ready(init);

export default QoL;

