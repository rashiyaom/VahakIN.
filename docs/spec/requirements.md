# VahakIN — Development Environment Requirements

**Project:** SFIC 2026 / PS000225 · **Platform:** macOS, Apple Silicon (M3 assumed) · **Scope:** additional development tools and dependencies, not hardware procurement.

Companion to `problem statement.md`, `architecture.md`, `harware.md`, `database.md` and `implementation.md`. This setup preserves their Next.js / FastAPI / Supabase / ESP-IDF architecture and adds the agreed MapLibre 2D/3D City experience. Commands are setup recipes, not results from a tested VahakIN repository. Pin tested versions and commit lockfiles when the repository is initialized.

## 1. Quick installation checklist

| Tool | When | Purpose |
|---|---|---|
| Python 3.12 | Now, if absent | Backend, simulator, later ML |
| Homebrew | Only if absent and using brew | macOS package manager |
| Xcode Command Line Tools | If absent | Native dependencies, firmware prerequisites |
| Supabase account | Now | Hosted PostgreSQL, PostGIS, Auth, Realtime |
| Docker Desktop for Apple Silicon | Before local database testing / container deployment | Local Supabase and API containers |
| Supabase CLI | Before schema migrations | Local development, schema management |
| ESP-IDF + ESP32-S3 toolchain | Hardware phase | Build, flash and monitor firmware |
| USB serial driver | Only if board requires it | USB-to-UART access |
| Playwright browsers | Testing phase | Browser automation |
| DBeaver / Bruno | Optional | SQL client / API testing GUI |
| QGIS / KiCad | Optional later | Inspect GIS data / design PCB |

Git, Node.js, npm and your existing editor are assumed installed. No separate global installation of React, Next.js, Tailwind, MapLibre, FastAPI or scikit-learn is needed.

## 2. Verify existing tools

Run in Terminal:

```bash
uname -m                     # arm64 on native Apple Silicon terminal
node -v
npm -v
git --version
python3 --version
brew --version
xcode-select -p
```

Use a supported Node LTS (Node 24 is a reasonable baseline if compatible with your project; Next.js documentation specifies a minimum of 20.9). Do not downgrade a compatible existing installation. Use native arm64 tooling when possible. Allow roughly 25–40 GB free disk space if installing the full local database and firmware toolchains; this is a planning estimate, not a vendor requirement. 8 GB RAM is workable with hosted Supabase and limited concurrent tools; 16 GB or more is preferable for running containers, IDE and browser together.

### Python and macOS build tools

If the Python version you already have is compatible with your chosen dependencies, skip reinstalling. Otherwise, with Homebrew:

```bash
brew install python@3.12
python3.12 --version
```

If command-line tools are missing:

```bash
xcode-select --install
```

If Homebrew is missing, use the official installer at https://brew.sh/ and follow its shell PATH instructions. A Python installer is also available at https://www.python.org/downloads/macos/.

## 3. Database and backend infrastructure

### Recommended initially: hosted Supabase

Create a development project at https://supabase.com/dashboard. Store its project URL and public/publishable key in the web application's local environment file. Obtain a server-side database connection string from the dashboard and use the appropriate pooler connection if direct IPv6 connectivity is unavailable. Keep all secrets out of the browser and Git.

Enable PostGIS through a reviewed SQL migration (check the extension schema in your environment; use the same schema consistently):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT postgis_full_version();
```

If installed in a dedicated `extensions` schema, schema-qualify the function or configure the search path deliberately. Apply the existing database specification's tables, constraints, RLS and grants before exposing data. Enable Realtime only on authorised projection/notification tables. Do not grant unrestricted access to raw telemetry.

You do not need to install PostgreSQL and PostGIS separately if you use Supabase. Use synthetic vehicle and identity data.

### Local Supabase (recommended before integration/CI testing)

Download Docker Desktop for Apple Silicon: https://www.docker.com/products/docker-desktop/. Start it before running local Supabase. Check licensing for your organisation if applicable.

```bash
docker version
docker compose version
```

At the repository root, after it exists, use a project-local CLI:

```bash
npm install --save-dev supabase
npx supabase --version
npx supabase init  # only if supabase/config.toml does not exist
npx supabase start
npx supabase status
```

Alternatively `brew install supabase/tap/supabase` and run `supabase` directly; choose one approach. Do not install the CLI with `npm install -g supabase`.

The existing specification uses `database/migrations/`. If adopting the Supabase CLI's conventional `supabase/migrations/` directory, move the migration source there or create a documented build step; do not maintain two independent migration histories. Test local migrations and demo seeds before pushing to any hosted project. `npx supabase db reset` destroys local data and should only be used on a disposable development stack. Stop local services when not needed with `npx supabase stop`.

Optional SQL GUI: https://dbeaver.io/download/. Supabase Studio is already provided, so this is not necessary. Optional `psql` CLI: `brew install libpq` (follow brew's PATH instructions).

## 4. Frontend packages — apps/web

For a new repository only, from the repository root:

```bash
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --use-npm
cd apps/web
```

If the Next.js app already exists, skip scaffolding and follow the existing package manager and lockfile (`npm ci` for an npm lockfile). Run the following only to add dependencies that are not yet declared.

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react recharts zod react-hook-form @hookform/resolvers
npm install next-themes motion
npm install maplibre-gl @turf/turf
npx shadcn@latest init
npx shadcn@latest add button card dialog dropdown-menu input label table tabs select badge sheet skeleton tooltip sonner
```

| Package | Use |
|---|---|
| Next.js, React, TypeScript | Existing scaffold, all portals |
| Tailwind CSS, shadcn/ui | Shared accessible design system |
| Lucide React | Icons |
| next-themes | Light/dark theme |
| motion | Restrained camera-independent UI transitions |
| Recharts | Dashboard charts |
| Zod, React Hook Form | Client-side forms and validation |
| Supabase JS / SSR | Authentication and scoped realtime |
| MapLibre GL JS | WebGL map, camera transitions, vector tiles, building extrusion |
| Turf.js | Client geofence preview and geometry helpers (server remains authoritative) |

Optional: `npm install react-map-gl` if choosing its MapLibre adapter rather than using MapLibre directly. Use the `react-map-gl/maplibre` entry point and check peer compatibility. No need to install both a React wrapper and separate competing map engines. Import `maplibre-gl/dist/maplibre-gl.css` and initialise map components on the client only.

Run `npm run dev` and open http://localhost:3000. Commit `package-lock.json`; team members should use `npm ci` thereafter. Do not install Next.js or Tailwind globally.

## 5. Mapping requirements — 2D, Satellite, 3D City

| Requirement | Dependency / data source | When |
|---|---|---|
| Standard map | MapLibre GL JS + OpenFreeMap | Now |
| 3D City | Existing MapLibre `fill-extrusion` layers and building vector data | During map development |
| Geofence overlays | GeoJSON + Turf + PostGIS | Now |
| Highway glow | MapLibre line layers, custom style | During styling |
| Satellite | Separately licensed imagery tile provider, credentials if required | Optional until provider selected |
| India/state/office boundaries | Authorised and correctly licensed boundary data | Before jurisdiction map |
| Live telemetry | Supabase Realtime scoped updates / polling fallback | Integration |

OpenFreeMap example style URL: `https://tiles.openfreemap.org/styles/liberty` (see https://openfreemap.org/quick_start/). It does not require a separate local tile server for normal prototype use. Retain attribution and verify provider terms, availability and Indian boundary depiction requirements before deployment. Never substitute unverified district polygons for actual RTO jurisdiction assignments.

For 3D City, use a custom vector style with extrusion enabled only at detailed zoom levels (start around zoom 15), optional camera tilt, and a 2D fallback. Verify building layer names and height attributes against the actual tile schema; Rajkot building coverage and heights may be incomplete. Estimated building heights are illustrative. Glowing highways are styling, not traffic measurements. Load only visible tiles and relevant vehicle features. Do not download all Indian maps or build 3D models.

Satellite is an imagery source, not a MapLibre package. Select an authorised provider with suitable coverage and embedding rights; preserve attribution and restrict browser-visible keys by provider capabilities. Satellite images are historical, not live. No Mapillary, Google Street View, Three.js, Cesium, Unity, Unreal Engine or local GIS server is needed for the requested extruded-building map. QGIS is optional for inspecting boundary datasets: https://qgis.org/.

## 6. Backend Python dependencies — services/api

Create an isolated environment, using the chosen Python interpreter. The repository's `pyproject.toml` should become the canonical dependency manifest.

```bash
cd services/api
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

If the backend package is not yet configured, initial candidate packages are:

```bash
python -m pip install 'fastapi[standard]' pydantic-settings 'psycopg[binary,pool]' httpx 'PyJWT[crypto]' supabase
python -m pip install reportlab
python -m pip install pytest pytest-asyncio ruff
```

| Dependency | Purpose |
|---|---|
| FastAPI + Uvicorn (standard extra) | Versioned HTTP API and OpenAPI |
| Pydantic / pydantic-settings | Telemetry validation and server config |
| psycopg 3 + pool | PostgreSQL queries, transactions, PostGIS functions |
| httpx | Provider adapters, simulator HTTP and API testing |
| PyJWT with cryptography | Verify Supabase tokens with correct issuer, audience and key configuration |
| supabase | Optional server-side Auth/Storage SDK operations |
| ReportLab | PDF reports; CSV uses Python standard library |
| pytest, pytest-asyncio, Ruff | Tests and linting |

Python standard library `hmac`, `hashlib`, `json`, `uuid` and `sqlite3` need no installation. Implement device HMAC using shared protocol test vectors and TLS; never skip TLS certificate checks. SQLAlchemy/GeoAlchemy2 are optional if choosing ORM-based access; Alembic is optional only if selected as the sole schema migration system. Do not duplicate Supabase SQL migrations. Redis, Celery and Kafka are not initial requirements: use the database-backed durable worker from the architecture.

Once `pyproject.toml` and a lock strategy exist, install from those (e.g. `python -m pip install -e '.[dev]'` if the project defines that extra). Record tested versions, do not treat these unpinned discovery commands as production lockfiles.

After implementing `app/main.py`:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for Swagger UI. This only works when the FastAPI application actually exists. Start the database-backed worker separately after implementation. Use an explicit local CORS origin for the web app.

## 7. Device simulator and machine learning

Simulator can reuse backend environment or have its own isolated environment with `httpx`, `pydantic`, and `pytest`. Python standard library handles timing, deterministic scenario generation and HMAC. Use the same telemetry schema and ingestion route as the physical device, with distinct demo credentials and source labels. No Arduino or ESP-IDF required to build the simulator.

For the later ML phase, create a separate environment under `ml/`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install numpy pandas scipy scikit-learn matplotlib joblib jupyterlab
```

JupyterLab is optional; run `jupyter lab` if needed. Start with rule-based motion and GPS corroboration before collecting labelled data. No TensorFlow, PyTorch, CUDA or dedicated GPU required initially. Add embedded model export tools only after selecting a measured model and checking firmware compatibility.

## 8. Firmware development — ESP32-S3

Owned hardware: ESP32-S3, MPU6050, SIM800L. Planned GNSS: NEO-6M. Follow `harware.md` for electrical validation; software installation does not resolve voltage compatibility.

Use the official ESP-IDF Installation Manager (EIM) for macOS: https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/macos-setup.html . Choose a stable ESP-IDF release compatible with the intended component libraries; record the version in project documentation. EIM installs required compiler/toolchain, build tools and its own Python environment. Keep that environment separate from the backend venv. Optionally install the official Espressif IDF VS Code extension (extension ID `espressif.esp-idf`) and configure it to the same installation.

Verify in an activated ESP-IDF terminal:

```bash
idf.py --version
ls /dev/cu.*
```

After creating the firmware project or opening a compatible ESP-IDF hello_world example:

```bash
idf.py set-target esp32s3
idf.py build
idf.py -p /dev/cu.YOUR_DEVICE flash monitor
```

Replace the serial placeholder with the real USB device path. Check the board's USB interface and data cable; native USB Serial/JTAG often needs no external driver. Install CP210x or CH34x/CH910x drivers only if that bridge chip is present and macOS does not recognise it, using the vendor's official installer. Do not disable OS security to install unknown drivers. Exit IDF monitor with Ctrl+].

Firmware libraries/drivers:

- ESP-IDF I2C, UART, GPIO, ADC, timer, sleep and Wi-Fi components.
- MPU6050 I2C driver, NEO-6M NMEA parsing, SIM800L AT-command state machine: select or implement compatible components in the repository; no global downloads required.
- ESP HTTP client, mbedTLS, NVS and local event queue; pin third-party components through IDF component manifests/lockfile.
- Optional `pyserial` in a separate diagnostic Python environment for serial capture.

Arduino IDE and PlatformIO are not required if ESP-IDF is selected. Use ESP32 Wi-Fi/phone hotspot for initial secure telemetry. SIM800L 2G/TLS capability must be tested before cellular integration; do not send sensitive data over insecure HTTP. Never connect the bare modem to an unverified 5V rail or power it through the ESP32 regulator.

## 9. Testing and quality tools

Inside `apps/web`:

```bash
npm install -D @playwright/test vitest @testing-library/react @testing-library/jest-dom jsdom
npx playwright install chromium
```

Use existing ESLint and TypeScript tooling. Configure test scripts, then run `npx tsc --noEmit`, `npm run lint` (if defined), `npx vitest run`, and `npx playwright test`. Add Firefox/WebKit browsers only when needed (`npx playwright install firefox webkit`). Run backend `python -m pytest` and `ruff check .` inside its venv. Use SQL/RLS tests, optionally pgTAP if available in the chosen database. Validate national/state/office/owner access isolation and map viewport queries. Benchmark 3D mode on low-end devices.

Optional tools: Bruno (https://www.usebruno.com/) or Postman for API testing; FastAPI Swagger UI and curl are enough initially. KiCad (https://www.kicad.org/) for later PCB schematic work. No extra API GUI is mandatory.

## 10. Service accounts and credentials (not laptop downloads)

| Service | Required now? | Notes |
|---|---|---|
| Supabase | Yes if hosted path | Development database/Auth/Realtime |
| OpenFreeMap | No account for public style | Map tiles, preserve attribution |
| Satellite imagery provider | Later | Licensed tiles and key if required |
| VAHAN / API Setu | No | DEMO/MANUAL mode until authorised access |
| Hosting (e.g. Vercel + API container host) | Later | Choose before remote hardware testing |
| Email/SMS/push provider | Later | In-app alerts first; verified recipients |

Environment templates should follow `implementation.md`. For web `.env.local`, include `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or project publishable key according to chosen naming). Use the selected public map style configuration. For backend `.env`, include `DATABASE_URL`, `SUPABASE_URL`, `APP_ENV=dev`, `TRANSPORT_RECORDS_MODE=DEMO`, `ALLOWED_ORIGINS`, `MAP_STYLE_URL` where needed, and server-only credentials only when required. Never put service-role keys, device secrets or database passwords in `NEXT_PUBLIC_*`. Keep actual environment files untracked and provide placeholder-only `.env.example` files.

## 11. Suggested order of work

- [ ] Verify existing Node/npm/Git/editor and Python.
- [ ] Install Python if needed and create hosted Supabase development project.
- [ ] Scaffold Next.js and FastAPI; install project-local packages.
- [ ] Apply database migrations and security policies; seed fictional records.
- [ ] Build landing page, government login, role-based portals and owner portal.
- [ ] Integrate MapLibre standard map, then 3D City toggle, geofences and live updates.
- [ ] Build simulator and demonstrate ingestion, alerts and investigation workflow.
- [ ] Install Docker / local Supabase CLI and run reproducible migration/security tests.
- [ ] Install ESP-IDF, verify serial connection and flash basic firmware.
- [ ] Integrate sensors on a validated power circuit; test Wi-Fi, offline retry, then SIM800L.
- [ ] Add optional ML, satellite imagery, reporting and deployment tools as needed.

For website work today, the only likely additional system installation is Python (if absent). Hosted Supabase avoids running Docker immediately. Frontend packages are installed in the project, not system-wide. A local database stack is still recommended before integration testing and deployment.

## 12. Official documentation

- Next.js: https://nextjs.org/docs/app/getting-started/installation
- Supabase CLI: https://supabase.com/docs/guides/local-development/cli/getting-started
- FastAPI: https://fastapi.tiangolo.com/
- MapLibre: https://maplibre.org/maplibre-gl-js/docs/
- OpenFreeMap: https://openfreemap.org/quick_start/
- shadcn/ui: https://ui.shadcn.com/docs/installation/next
- ESP-IDF: https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/index.html
- Playwright: https://playwright.dev/docs/intro

**Validation status:** the existing project specifications were inspected. Next.js, Supabase CLI, OpenFreeMap and ESP-IDF setup references were checked. The dependency list is a proposed bootstrap, not a tested lockfile; the exact repository state, installed laptop versions, satellite provider, hardware variant and secure cellular capability remain unverified.
