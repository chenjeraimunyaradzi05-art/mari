const fs = require('fs');
const path = require('path');

function listPhpMigrations(dir) {
  const files = [];
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (/\.php$/.test(f) && /migrations/.test(d)) files.push(p);
    }
  }
  walk(dir);
  return files;
}

const templateDir = path.resolve(__dirname, '..', 'template');
const repoDir = path.resolve(__dirname, '..');
const phpFiles = listPhpMigrations(templateDir);
const missing = [];
for (const php of phpFiles) {
  const base = path.basename(php).replace(/\.php$/, '.js');
  const candidate = path.join(repoDir, 'database', 'migrations', base);
  if (!fs.existsSync(candidate)) missing.push({php, expectedJs: candidate});
}
console.log(JSON.stringify(missing, null, 2));
