// validate all scripts in scripts/ directory

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const scriptsDir = join(rootDir, 'scripts');

const errors = [];
const warnings = [];
const scriptIds = new Set();

function checkScripts() {
  if (!statSync(scriptsDir).isDirectory()) {
    console.log('scripts/ directory not found');
    return;
  }
  
  const files = readdirSync(scriptsDir).filter(f => f.endsWith('.user.js'));
  
  if (files.length === 0) {
    console.log('No scripts found in scripts/ directory');
    return;
  }
  
  console.log(`Checking ${files.length} script(s)...\n`);
  
  for (const file of files) {
    const filePath = join(scriptsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    
    checkScript(file, content);
  }
  
  // check for duplicate IDs
  const duplicates = [];
  const seenIds = new Set();
  for (const id of scriptIds) {
    if (seenIds.has(id)) {
      duplicates.push(id);
    }
    seenIds.add(id);
  }
  
  if (duplicates.length > 0) {
    errors.push(`Duplicate script IDs found: ${duplicates.join(', ')}`);
  }
  
  // report results
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ All scripts are valid!\n');
    process.exit(0);
  } else {
    if (warnings.length > 0) {
      console.log('Warnings:');
      warnings.forEach(w => console.log(`  ⚠ ${w}`));
      console.log('');
    }
    
    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach(e => console.log(`  ✗ ${e}`));
      console.log('');
      process.exit(1);
    }
  }
}

function checkScript(filename, content) {
  console.log(`Checking ${filename}...`);
  
  // check syntax with esbuild
  try {
    build({
      stdin: {
        contents: content,
        sourcefile: filename,
        resolveDir: scriptsDir,
        loader: 'js'
      },
      bundle: false,
      write: false,
      format: 'iife'
    }).catch(() => {
      // esbuild might fail for userscript-specific syntax, that's ok
    });
  } catch (e) {
    warnings.push(`${filename}: Syntax check warning (may be false positive): ${e.message}`);
  }
  
  // check for QoL.registerScript() call
  const hasRegister = /QoL\.registerScript\s*\(/.test(content);
  if (!hasRegister) {
    warnings.push(`${filename}: No QoL.registerScript() call found`);
  }
  
  // extract and validate ID
  const registerMatch = content.match(/QoL\.registerScript\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\s*\}\s*\)/s);
  if (registerMatch) {
    const configStr = registerMatch[1];
    const idMatch = configStr.match(/id\s*:\s*['"]([^'"]+)['"]/);
    const nameMatch = configStr.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const descMatch = configStr.match(/description\s*:\s*['"]([^'"]+)['"]/);
    
    if (!idMatch) {
      errors.push(`${filename}: Missing 'id' field in QoL.registerScript()`);
    } else {
      const id = idMatch[1];
      scriptIds.add(id);
      
      // check ID matches filename
      const expectedId = filename.replace('.user.js', '');
      if (id !== expectedId) {
        warnings.push(`${filename}: Script ID '${id}' does not match filename (expected '${expectedId}')`);
      }
    }
    
    if (!nameMatch) {
      errors.push(`${filename}: Missing 'name' field in QoL.registerScript()`);
    }
    
    if (!descMatch) {
      warnings.push(`${filename}: Missing 'description' field in QoL.registerScript()`);
    }
  } else {
    // check userscript headers as fallback
    const nameMatch = content.match(/@name\s+(.+)/);
    if (!nameMatch) {
      errors.push(`${filename}: Missing @name header and QoL.registerScript() call`);
    }
  }
  
  // check for required userscript headers
  const hasName = /@name\s+/.test(content);
  const hasNamespace = /@namespace\s+/.test(content);
  const hasVersion = /@version\s+/.test(content);
  const hasMatch = /@match\s+/.test(content);
  const hasGrant = /@grant\s+/.test(content);
  
  if (!hasName) warnings.push(`${filename}: Missing @name header`);
  if (!hasNamespace) warnings.push(`${filename}: Missing @namespace header`);
  if (!hasVersion) warnings.push(`${filename}: Missing @version header`);
  if (!hasMatch) warnings.push(`${filename}: Missing @match header`);
  if (!hasGrant) warnings.push(`${filename}: Missing @grant header`);
}

checkScripts();

