const fs = require('fs');
const path = require('path');

function listPhpMigrations(root) {
  const out = [];
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (/\.php$/.test(f) && /migrations/.test(d)) out.push(p);
    }
  }
  walk(root);
  return out;
}

const repo = path.resolve(__dirname, '..');
const phpFiles = listPhpMigrations(repo);
const missing = [];
for (const php of phpFiles) {
  const base = path.basename(php).replace(/\.php$/, '.js');
  const expected = path.join(repo, 'database', 'migrations', base);
  if (!fs.existsSync(expected)) missing.push({php, expected});
}
console.log(JSON.stringify(missing, null, 2));
