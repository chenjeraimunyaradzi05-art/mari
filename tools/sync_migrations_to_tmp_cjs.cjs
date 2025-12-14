const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'database', 'migrations');
const destDir = path.resolve(__dirname, '..', 'tmp', 'migrations_cjs');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
for (const f of files) {
  const src = path.join(srcDir, f);
  const destName = f.replace(/\.js$/, '.cjs');
  const dest = path.join(destDir, destName);
  const srcStat = fs.statSync(src);
  let copy = true;
  if (fs.existsSync(dest)) {
    const destStat = fs.statSync(dest);
    if (destStat.mtimeMs >= srcStat.mtimeMs) copy = false;
  }
  if (copy) {
    const content = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, content, 'utf8');
    console.log('Copied', f, '->', destName);
  }
}

console.log('Sync complete');
