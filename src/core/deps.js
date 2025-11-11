// dependency loader/cache for shared libraries

const cache = new Map();
const loading = new Map();

const CDN_URLS = {
  'turndown': 'https://unpkg.com/turndown/dist/turndown.js',
  'turndown-gfm': 'https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js',
  'readability': 'https://cdn.jsdelivr.net/gh/mozilla/readability@master/Readability.js'
};

export const Deps = {
  // load a dependency by name or custom URL
  async load(name, url) {
    // check cache first
    if (cache.has(name)) {
      return cache.get(name);
    }

    // check if already loading
    if (loading.has(name)) {
      return loading.get(name);
    }

    // start loading
    const loadPromise = this._loadScript(name, url || CDN_URLS[name]);
    loading.set(name, loadPromise);

    try {
      const result = await loadPromise;
      cache.set(name, result);
      loading.delete(name);
      return result;
    } catch (error) {
      loading.delete(name);
      throw error;
    }
  },

  // internal: load script from URL
  _loadScript(name, url) {
    if (!url) {
      return Promise.reject(new Error(`No URL found for dependency: ${name}`));
    }

    return new Promise((resolve, reject) => {
      // check if already loaded globally
      if (name === 'turndown' && typeof TurndownService !== 'undefined') {
        resolve(TurndownService);
        return;
      }
      if (name === 'turndown-gfm' && typeof turndownPluginGfm !== 'undefined') {
        resolve(turndownPluginGfm);
        return;
      }
      if (name === 'readability' && typeof Readability !== 'undefined') {
        resolve(Readability);
        return;
      }

      // inject script tag
      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      script.onload = () => {
        // resolve with global object
        let result;
        if (name === 'turndown') {
          result = typeof TurndownService !== 'undefined' ? TurndownService : window.TurndownService;
        } else if (name === 'turndown-gfm') {
          result = typeof turndownPluginGfm !== 'undefined' ? turndownPluginGfm : window.turndownPluginGfm;
        } else if (name === 'readability') {
          result = typeof Readability !== 'undefined' ? Readability : window.Readability;
        } else {
          result = window[name];
        }

        if (!result) {
          reject(new Error(`Dependency ${name} loaded but not found in global scope`));
        } else {
          resolve(result);
        }
      };

      script.onerror = () => {
        reject(new Error(`Failed to load dependency: ${name} from ${url}`));
      };

      document.head.appendChild(script);
    });
  },

  // check if dependency is cached
  has(name) {
    return cache.has(name);
  },

  // clear cache
  clear() {
    cache.clear();
    loading.clear();
  }
};

