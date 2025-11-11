// interactive CLI to scaffold new script

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const scriptsDir = join(rootDir, 'scripts');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function scaffold() {
  console.log('QoL Script Scaffolder\n');
  
  // get script ID
  let scriptId = await question('Script ID (e.g., "my-script"): ');
  scriptId = scriptId.trim();
  
  if (!scriptId) {
    console.error('Script ID is required');
    rl.close();
    process.exit(1);
  }
  
  // validate ID format
  if (!/^[a-z0-9-]+$/.test(scriptId)) {
    console.error('Script ID must contain only lowercase letters, numbers, and hyphens');
    rl.close();
    process.exit(1);
  }
  
  // check if already exists
  const filePath = join(scriptsDir, `${scriptId}.user.js`);
  if (existsSync(filePath)) {
    const overwrite = await question(`Script ${scriptId} already exists. Overwrite? (y/N): `);
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Cancelled');
      rl.close();
      process.exit(0);
    }
  }
  
  // get other fields
  const name = (await question('Script name: ')).trim() || scriptId;
  const description = (await question('Description: ')).trim() || 'A QoL userscript';
  const defaultEnabled = (await question('Enabled by default? (Y/n): ')).trim().toLowerCase() !== 'n';
  
  // generate script content
  const content = generateScript(scriptId, name, description, defaultEnabled);
  
  // write file
  writeFileSync(filePath, content, 'utf-8');
  
  console.log(`\n✓ Created ${filePath}`);
  console.log('Next steps:');
  console.log('  1. Edit the script to add your functionality');
  console.log('  2. Define settings schema if needed');
  console.log('  3. Run "npm run check:scripts" to validate');
  console.log('  4. Run "npm run build:all" to build');
  
  rl.close();
}

function generateScript(id, name, description, enabled) {
  return `// ==UserScript==
// @name         ${name}
// @namespace    qol-${id}
// @version      1.0.0
// @description  ${description}
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://raw.githubusercontent.com/pc-style/qol/main/dist/qol-framework.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // wait for QoL framework to load
  if (typeof QoL === 'undefined') {
    console.error('[${id}] QoL framework not loaded');
    return;
  }

  QoL.registerScript({
    id: '${id}',
    name: '${name}',
    description: '${description}',
    version: '1.0.0',
    enabled: ${enabled},
    
    settings: {
      // example settings - customize as needed
      // enabled: { type: 'toggle', default: true, label: 'Enable script' },
      // hotkey: { type: 'text', default: 'Alt+X', label: 'Hotkey' }
    },
    
    init() {
      // initialization logic here
      console.log('[${id}] Script initialized');
      
      // return instance object if needed for cleanup
      return {
        // instance state
      };
    },
    
    destroy(instance) {
      // cleanup logic here
      console.log('[${id}] Script destroyed');
    }
  });
})();
`;
}

scaffold().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});

