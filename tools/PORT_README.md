Port PHP controllers and routes to JS stubs
=========================================

Usage
-----

1. Generate JS stubs from the template PHP controllers and routes:

```bash
node tools/port_php_to_js.cjs
```

2. This will:
- Create controller stubs under `src/lib/controllers/...` mirroring PHP namespaces.
- Create route stubs under `src/app/api/...` for simple `Route::get/post/...` entries.

Notes
-----
- The generator is intentionally conservative: it creates TODO stubs for methods and a 501 response in route stubs.
- It currently handles simple route declarations like `Route::get('/path', 'Controller@method')` and basic path parameters `{id}`.
- After generation, manually port complex controller logic and improve route handlers to use the application's auth/middleware patterns.

Next steps
----------
- Iterate in batches: port controllers, add tests, and replace 501 stubs with real implementations.
- Add CI job to run this generator and fail PRs which add PHP controllers without JS equivalents.
