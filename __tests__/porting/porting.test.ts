import fs from 'fs';
import path from 'path';

test('generated controller stubs exist', () => {
  const f = path.resolve(__dirname, '..', '..', 'src', 'lib', 'controllers', 'Http', 'Controllers', 'Api', 'V1', 'AuthController.js');
  expect(fs.existsSync(f)).toBe(true);
});

test('some route stubs exist', () => {
  const r = path.resolve(__dirname, '..', '..', 'src', 'app', 'api', 'leads', 'route.ts');
  expect(fs.existsSync(r)).toBe(true);
});
