#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing all TypeScript import extensions...');

const srcDir = path.join(__dirname, 'src');

// Patterns to fix
const patterns = [
  { from: /from ['"]\.\.\/middleware\/auth['"];/g, to: 'from "../middleware/auth.js";' },
  { from: /from ['"]\.\.\/controllers\/([^'"]+)['"];/g, to: 'from "../controllers/$1.js";' },
  { from: /from ['"]\.\.\/middleware\/([^'"]+)['"];/g, to: 'from "../middleware/$1.js";' },
  { from: /from ['"]\.\.\/types\/([^'"]+)['"];/g, to: 'from "../types/$1.js";' },
  { from: /from ['"]\.\/controllers\/([^'"]+)['"];/g, to: 'from "./controllers/$1.js";' },
  { from: /from ['"]\.\/middleware\/([^'"]+)['"];/g, to: 'from "./middleware/$1.js";' },
  { from: /from ['"]\.\/types\/([^'"]+)['"];/g, to: 'from "./types/$1.js";' }
];

function fixFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let updatedContent = content;
    let changed = false;

    patterns.forEach(pattern => {
      if (pattern.from.test(updatedContent)) {
        updatedContent = updatedContent.replace(pattern.from, pattern.to);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, updatedContent);
      console.log(`✅ Fixed: ${path.relative(__dirname, filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

function walkDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      walkDirectory(itemPath);
    } else if (item.endsWith('.ts')) {
      fixFile(itemPath);
    }
  });
}

walkDirectory(srcDir);
console.log('🎉 Import fixing complete!');