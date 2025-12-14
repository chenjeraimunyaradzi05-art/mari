const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));
let changed = [];
for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let s = fs.readFileSync(filePath, 'utf8');
  // process only if file contains 'await knex.schema.hasColumn'
  if (!/await\s+knex\.schema\.hasColumn\(/.test(s)) continue;

  // For exports.up and exports.down separately
  ['up', 'down'].forEach((fn) => {
    const fnPattern = new RegExp(`exports\\.${fn}\\s*=\\s*async function\\(knex\\)\\s*{`);
    const m = fnPattern.exec(s);
    if (!m) return;
    const insertPos = m.index + m[0].length;
    // find all occurrences of await knex.schema.hasColumn(...) within this function's braces
    // crude approach: find function body text by searching until the matching closing brace at same indentation is found
    // To keep it simple, we'll take up to exports.(otherFn) or end of file
    const tail = s.slice(insertPos);
    const endIdx = tail.search(/\n}\n\nexports\.|\n}\n\n$/);
    const funcBody = endIdx === -1 ? tail : tail.slice(0, endIdx);

    const regex = /await\s+knex\.schema\.hasColumn\([^)]*\)/g;
    const matches = [...funcBody.matchAll(regex)].map(m => m[0]);
    if (matches.length === 0) return;

    const unique = Array.from(new Set(matches));
    let decls = '';
    unique.forEach((matchText, idx) => {
      const varName = `__has_col_${fn}_${idx}`;
      // create declaration using the same arguments
      const call = matchText.replace(/^await\s+/, '');
      decls += `  const ${varName} = await ${call};\n`;
      // replace all occurrences of this matchText in the function body with varName
      const matchEsc = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(matchEsc, 'g');
      s = s.replace(re, varName);
    });

    // insert decls after function opening brace
    s = s.slice(0, insertPos) + '\n' + decls + s.slice(insertPos);
  });

  if (s !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath + '.bak', fs.readFileSync(filePath, 'utf8'));
    fs.writeFileSync(filePath, s, 'utf8');
    changed.push(file);
  }
}
console.log('Fixed files:', changed);