// per-script namespaced storage using GM_getValue/GM_setValue

export const Store = {
  // get value for a script's key
  get(scriptId, key, defaultValue) {
    const storageKey = `qol:${scriptId}:${key}`;
    const value = GM_getValue(storageKey, defaultValue);
    // try to parse JSON if it looks like an object/array
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  },

  // set value for a script's key
  set(scriptId, key, value) {
    const storageKey = `qol:${scriptId}:${key}`;
    // serialize objects/arrays to JSON
    const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
    GM_setValue(storageKey, serialized);
  },

  // get all settings for a script
  getAll(scriptId) {
    const prefix = `qol:${scriptId}:`;
    const all = GM_listValues();
    const scriptSettings = {};
    
    for (const key of all) {
      if (key.startsWith(prefix)) {
        const settingKey = key.slice(prefix.length);
        scriptSettings[settingKey] = this.get(scriptId, settingKey);
      }
    }
    
    return scriptSettings;
  },

  // remove a specific key
  remove(scriptId, key) {
    const storageKey = `qol:${scriptId}:${key}`;
    GM_deleteValue(storageKey);
  },

  // clear all settings for a script
  clear(scriptId) {
    const prefix = `qol:${scriptId}:`;
    const all = GM_listValues();
    
    for (const key of all) {
      if (key.startsWith(prefix)) {
        GM_deleteValue(key);
      }
    }
  }
};

