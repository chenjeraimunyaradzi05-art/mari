const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function phpNamespaceToPath(ns) {
  return ns.replace(/^App\\/, '').replace(/\\/g, '/');
}

function parsePhpController(filePath) {
  const s = fs.readFileSync(filePath, 'utf8');
  const nsMatch = s.match(/namespace\s+([^;]+);/);
  const clsMatch = s.match(/class\s+(\w+)/);
  if (!clsMatch) return null;
  const namespace = nsMatch ? nsMatch[1].trim() : '';
  const className = clsMatch[1];
  const methodRegex = /public\s+function\s+(\w+)\s*\(/g;
  const methods = [];
  let m;
  while ((m = methodRegex.exec(s))) methods.push(m[1]);
  return { namespace, className, methods };
}

function writeControllerStub(info, srcRoot) {
  const rel = phpNamespaceToPath(info.namespace || '');
  const outDir = path.resolve(srcRoot, 'src', 'lib', 'controllers', rel);
  ensureDir(outDir);
  const outFile = path.resolve(outDir, info.className + '.js');
  const lines = [];
  lines.push(`// Auto-generated stub for ${info.namespace}\\${info.className}`);
  lines.push('');
  info.methods.forEach((m) => {
    lines.push(`export async function ${m}(req, res) {`);
    lines.push("  // TODO: port logic from PHP controller method");
    lines.push("  return new Response(JSON.stringify({ message: 'Not implemented' }), { status: 501 });");
    lines.push('}');
    lines.push('');
  });
  fs.writeFileSync(outFile, lines.join('\n'));
  return outFile;
}

function parseRoutesAndGenerate(routeFile, srcRoot) {
  const s = fs.readFileSync(routeFile, 'utf8');
  const routeRegex = /Route::(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^@']+)@([^'"\)]+)['"]/g;
  let m;
  const created = [];
  while ((m = routeRegex.exec(s))) {
    const verb = m[1].toUpperCase();
    const routePath = m[2];
    const controller = m[3];
    const method = m[4];
    // convert Laravel path /api/users/{id} -> src/app/api/api/users/[id]/route.js
    const segs = routePath.split('/').filter(Boolean).map((seg) => seg.replace(/^{(.+)}$/, '[$1]'));
    const apiDir = path.resolve(srcRoot, 'src', 'app', 'api', ...segs);
    ensureDir(apiDir);
    const routeFilePath = path.resolve(apiDir, 'route.js');
    const handlerImport = `// Route stub for ${verb} ${routePath}\nexport async function ${verb}(req) {\n  return new Response(JSON.stringify({ message: 'Not implemented' }), { status: 501 });\n}\n`;
    if (!fs.existsSync(routeFilePath)) fs.writeFileSync(routeFilePath, handlerImport);
    created.push(routeFilePath);
  }
  return created;
}

(async function main() {
  const appTemplate = path.resolve(__dirname, '..', 'template');
  const srcRoot = path.resolve(__dirname, '..');
  const controllersRoot = path.resolve(appTemplate, 'app', 'Http', 'Controllers');
  if (!fs.existsSync(controllersRoot)) {
    console.error('Controllers directory not found:', controllersRoot);
    process.exit(1);
  }

  const files = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (p.endsWith('.php')) files.push(p);
    }
  })(controllersRoot);

  console.log('Found', files.length, 'PHP controller files. Generating stubs...');
  for (const f of files) {
    const info = parsePhpController(f);
    if (!info) continue;
    // only port Api namespace for first pass
    if (info.namespace && info.namespace.includes('Api')) {
      const out = writeControllerStub(info, srcRoot);
      console.log('Wrote', out);
    }
  }

  // parse route files
  const routesDir = path.resolve(appTemplate, 'routes');
  if (fs.existsSync(routesDir)) {
    for (const rf of fs.readdirSync(routesDir)) {
      if (!rf.endsWith('.php')) continue;
      const created = parseRoutesAndGenerate(path.join(routesDir, rf), srcRoot);
      created.forEach((c) => console.log('Created route stub', c));
    }
  }

  console.log('Done. Re-run to extend to more namespaces or refine stubs.');
})();
