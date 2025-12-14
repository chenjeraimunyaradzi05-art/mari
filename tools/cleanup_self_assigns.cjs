const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));
let changed = [];
for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let s = fs.readFileSync(filePath, 'utf8');
  const orig = s;
  // remove self-assignments like: const __has_col_up_0 = __has_col_up_0;
  s = s.replace(/^\s*const\s+__has_col_(?:up|down)_\d+\s*=\s*__has_col_(?:up|down)_\d+;\s*\n/gm, '');
  if (s !== orig) {
    fs.writeFileSync(filePath + '.bak2', orig, 'utf8');
    fs.writeFileSync(filePath, s, 'utf8');
    changed.push(file);
  }
}
console.log('Cleaned files:', changed);
