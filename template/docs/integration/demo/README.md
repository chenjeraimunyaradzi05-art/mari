Demo site for ATHENA TurboTax integration POC

How to use
1. Ensure the local ATHENA backend is running and accessible at the working host (e.g. http://localhost)
2. Serve the docs folder on a simple static server or open `docs/integration/demo/index.html` in a browser within the app environment so relative API calls reach the same host.

Quick example (PowerShell):

# Serve using Python's simple HTTP server
env:PSHOME
python -m http.server --directory docs/integration/demo 8000

Open http://localhost:8000 in your browser

Notes
  - POST /api/v1/turbotax/oauth/start
  - POST /api/v1/turbotax/projection
How to use
1. Ensure the local ATHENA backend is running and accessible at the working host (e.g. http://localhost)
2. Serve the docs folder on a simple static server or open `docs/integration/demo/index.html` in a browser within the app environment so relative API calls reach the same host.

Quick example (PowerShell):

    # Serve using Python's simple HTTP server
    env:PSHOME
    python -m http.server --directory docs/integration/demo 8000

Open http://localhost:8000 in your browser

Hosting this demo live
---------------------

You can publish the demo to a static hosting service for partner testing. The repository contains two simple deployment options:

- GitHub Pages (via the included GitHub Actions workflow)
- Netlify / Vercel (single-directory static deploy)

GitHub Pages (recommended for quick partner demos)
-------------------------------------------------

1. Push your branch or changes to the repository (main or the branch you want to deploy from).
2. Trigger the workflow from Actions > Deploy demo to gh-pages, or push to main/dispatch the workflow.
3. The workflow publishes the contents of `docs/integration/demo` to the `gh-pages` branch.
4. The demo will be available at: https://<your-github-username-or-org>.github.io/<repo-name>/integration/demo/

Note: repo-level GitHub Pages settings determine the final URL. If Pages is already configured to publish from gh-pages, the above path will work.

Triggering the GH Actions workflow manually
-----------------------------------------

1. In GitHub, open the repository > Actions > Deploy demo to gh-pages.
2. Click "Run workflow" (you may choose a branch or tag to publish).
3. Watch the Logs: the workflow will check out the repo and upload the contents of `docs/integration/demo` into the `gh-pages` branch.

If you need to change the workflow, see `.github/workflows/deploy-demo-gh-pages.yml` in the repository.

CLI: dispatch the workflow from your machine
-------------------------------------------

Two small helper scripts are included in this folder so you can dispatch the "Deploy demo to gh-pages" workflow from the command line.

Files added:

- `trigger_demo_github_dispatch.ps1` — PowerShell helper; uses `gh` if available or falls back to the GitHub Actions API with `GITHUB_TOKEN`.
- `trigger_demo_github_dispatch.sh` — Bash helper; same behavior for Unix-like shells.

Examples

1) Using GitHub CLI (recommended):

  gh auth login
  gh workflow run deploy-demo-gh-pages.yml --repo MansaAkubari/source-code --ref main

2) Using the provided PowerShell helper (Windows / PowerShell):

  pwsh ./trigger_demo_github_dispatch.ps1 -RepoOwner "MansaAkubari" -RepoName "source-code" -Workflow "deploy-demo-gh-pages.yml" -Ref "main"

3) Using the bash helper and an exported token:

  export GITHUB_TOKEN=ghp_xxx
  ./trigger_demo_github_dispatch.sh MansaAkubari source-code deploy-demo-gh-pages.yml main

Note: the PAT stored in `GITHUB_TOKEN` must include the `workflow` scope (or repo-level access that allows workflow dispatch).

Netlify / Vercel
----------------

- Netlify: drag-and-drop the `docs/integration/demo` folder, or create a new site and point the publish directory to `docs/integration/demo` (netlify.toml already pre-configures this).
- Vercel: connect the repository, set the output directory to `docs/integration/demo` and enable static deployment.

Expected behaviour and troubleshooting
-------------------------------------

- The demo's frontend calls the API endpoints relative to the site origin. If the backend is hosted elsewhere, update the demo's config (or set up a reverse proxy) to ensure requests reach your backend (see CORS note below).
- If you see CORS errors, make sure your ATHENA instance allows the demo origin (or use a proxy in front of the API during testing).
- If the OAuth redirect doesn't complete, verify the OAuth client settings (redirect URLs) in your integration settings and ensure the demo is registered as an allowed callback.

Testing the hosted demo
-----------------------

1. Open the deployed demo URL in a partner-facing browser session.
2. Use the "Start TurboTax OAuth" button to begin the flow — the app will call the configured `/api/v1/turbotax/oauth/start` endpoint.
3. If the app calls your local backend (e.g., http://localhost) instead of the deployed backend, update the demo runtime variables to point to the publicly reachable backend endpoint.

Pointing the demo at a staging or public backend
------------------------------------------------

The demo supports a lightweight runtime configuration so you can host the demo on a public URL and still point it at your chosen ATHENA backend (for partner testing). You have three ways to set which backend the demo calls:

1. Query string — append `?apiBase=https://athena.example.com` to the demo URL.
   - Example: https://<org>.github.io/<repo>/integration/demo/?apiBase=https://athena-api.example.com
2. Local storage — use the API Base input at the top of the demo to save a backend URL locally for future visits.
3. Leave empty — the demo will default to the current site origin.

Using a query param is convenient for short-lived shareable staging links. Using the input + Save stores the host in your browser's localStorage and will persist across visits.

OAuth redirect note for hosted demos
-----------------------------------

When you host the demo on a public URL and initiate the TurboTax OAuth flow, make sure the demo's fully-qualified URL is included in the OAuth client configuration (redirect / callback URLs) for your POC application. For example, if the demo is publicly hosted at:

  https://partners.example.com/integration/demo

Add that URL as an allowed callback in your OAuth client settings (exact path depends on how you implement the callback). Failing to add the hosted demo URL to the OAuth redirect allowlist will block the OAuth exchange in partner sessions.

Notes
- The demo calls the following endpoints relative to the current origin:
  - POST /api/v1/turbotax/oauth/start
  - POST /api/v1/turbotax/projection
- Ensure CORS and server are configured for your local environment.

CORS / Proxy notes
------------------

- When the demo is hosting on a different origin than your ATHENA API, configure the API CORS to allow the demo origin, for example:

  Access-Control-Allow-Origin: https://<demo-host>
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization

- Alternatively, deploy a tiny reverse-proxy in front of your API that maps `/<repo-path>/api` to your backend to keep the same origin during testing.
