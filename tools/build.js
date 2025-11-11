// esbuild bundler for framework and scripts

import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const scriptsDir = join(rootDir, 'scripts');
const distDir = join(rootDir, 'dist');

// ensure dist directory exists
if (!statSync(distDir).isDirectory()) {
  mkdirSync(distDir, { recursive: true });
}

// userscript header template
const FRAMEWORK_HEADER = `// ==UserScript==
// @name         QoL Framework
// @namespace    qol-framework
// @version      1.0.2
// @description  Quality of Life userscript framework
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_deleteValue
// @updateURL    https://cdn.jsdelivr.net/gh/pc-style/qol@latest/dist/qol-framework.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/pc-style/qol@latest/dist/qol-framework.user.js
// @run-at       document-start
// ==/UserScript==

`;

async function buildFramework() {
  console.log('Building framework...');
  
  try {
    const result = await build({
      entryPoints: [join(srcDir, 'index.js')],
      bundle: true,
      format: 'iife',
      outfile: join(distDir, 'qol-framework.user.js'),
      banner: {
        js: FRAMEWORK_HEADER
      },
      minify: false, // keep readable for now
      sourcemap: false,
      target: 'es2020',
      platform: 'browser',
      globalName: 'QoLFramework',
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
    
    console.log('✓ Framework built successfully');
    return true;
  } catch (error) {
    console.error('✗ Framework build failed:', error);
    return false;
  }
}

async function buildScripts() {
  if (!statSync(scriptsDir).isDirectory()) {
    console.log('No scripts directory found');
    return true;
  }
  
  const files = readdirSync(scriptsDir).filter(f => f.endsWith('.user.js'));
  
  if (files.length === 0) {
    console.log('No scripts to build');
    return true;
  }
  
  console.log(`Building ${files.length} script(s)...`);
  
  for (const file of files) {
    const filePath = join(scriptsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    
    // extract userscript header
    const headerMatch = content.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    if (!headerMatch) {
      console.warn(`⚠ ${file}: No userscript header found, skipping`);
      continue;
    }
    
    const header = headerMatch[0];
    
    // ensure @require points to framework
    let modifiedHeader = header;
    if (!/@require.*qol-framework/.test(header)) {
      // add @require if not present
      modifiedHeader = header.replace(
        /(@run-at[^\n]*\n)/,
        `$1// @require      https://raw.githubusercontent.com/pc-style/qol/main/dist/qol-framework.user.js\n`
      );
    }
    
    // extract script body (everything after header)
    const body = content.slice(header.length).trim();
    
    // build script body with esbuild
    try {
      const result = await build({
        stdin: {
          contents: body,
          sourcefile: file,
          resolveDir: scriptsDir,
          loader: 'js'
        },
        bundle: true,
        format: 'iife',
        write: false,
        minify: false,
        sourcemap: false,
        target: 'es2020',
        platform: 'browser'
      });
      
      const bundledCode = result.outputFiles[0].text;
      
      // combine header + bundled code
      const finalContent = modifiedHeader + '\n\n' + bundledCode;
      
      // write to dist
      const outputPath = join(distDir, file);
      writeFileSync(outputPath, finalContent, 'utf-8');
      
      console.log(`✓ Built ${file}`);
    } catch (error) {
      console.error(`✗ Failed to build ${file}:`, error.message);
    }
  }
  
  return true;
}

async function main() {
  console.log('QoL Build Tool\n');
  
  const buildAll = process.argv.includes('--all');
  
  if (buildAll) {
    const frameworkOk = await buildFramework();
    if (!frameworkOk) {
      process.exit(1);
    }
    await buildScripts();
  } else {
    // build framework only
    const frameworkOk = await buildFramework();
    if (!frameworkOk) {
      process.exit(1);
    }
  }
  
  console.log('\n✓ Build complete');
}

main().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});

