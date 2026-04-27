# SchedView

> Schedule Request Dashboard — syncs from an internal Inventory API, persists in local SQLite, visualises VM→Baremetal placements.

_A bilingual README follows: English first, then 繁體中文 below._

---

## English

### Overview

SchedView shows scheduler output (**Schedule Request → Schedule Placements**) as a visual, queryable dashboard. The data lives in an internal **Inventory API** that the browser cannot reach, so SchedView acts as the server-side bridge: it pulls data on a timer (and on demand), stores it in a local SQLite database, and serves it to a Next.js React UI.

### Architecture

Three layers, each with a clean boundary.

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI layer — src/app, src/features/scheduler/                        │
│    Next.js App Router · React 19 · Tailwind v4 · TanStack Query     │
│    Zod-validated fetches to the Route Handlers below                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ fetch (same-origin)
┌──────────────────────────▼──────────────────────────────────────────┐
│  API layer — src/app/api/                                           │
│    GET  /api/schedule-requests              (list, includes vm_count)│
│    GET  /api/schedule-requests/:id/placement (detail, pre-joined)    │
│    POST /api/sync                            (manual trigger)        │
│    GET  /api/sync/status                     (inFlight + last run)   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ SQL (drizzle-orm · better-sqlite3)
┌──────────────────────────▼──────────────────────────────────────────┐
│  Sync + DB layer — src/lib/sync.ts, src/db/                         │
│    SQLite (./data/schedview.db) — schema.ts is the canonical shape  │
│    Periodic 5-min sync registered by src/instrumentation.ts         │
│    Single-flight lock — manual + periodic calls dedupe              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ InventoryClient interface
┌──────────────────────────▼──────────────────────────────────────────┐
│  Inventory client — src/lib/inventory-client.{ts,mock.ts,http.ts}   │
│    INVENTORY_MODE=mock (default) · seed=42 deterministic generator  │
│    INVENTORY_MODE=http            · real API (contract TBD)         │
└─────────────────────────────────────────────────────────────────────┘
```

### Data model

```
schedule_request (1) ──< (N) schedule_placement (0..1) ──> baremetal
                                                             (snapshot;
                                                              best-effort join)

schedule_request
  id, cluster_id, submitted_at, status, solver_status, solve_time_seconds,
  unplaced_count, requested_by, reason, synced_at, deleted_at  ← soft-delete

schedule_placement                                 ← one row per VM→BM mapping
  id, schedule_request_id (FK cascade), vm_id, vm_cpu_cores, vm_memory_mb,
  vm_disk_gb, vm_gpu_count, node_role, assigned_bm_id

baremetal                                         ← topology + capacity snapshot
  id, site/phase/datacenter/rack/unit/ag, total_*, used_*, bm_role,
  max_vm_count, current_vm_count, ip_types (JSON), snapshot_at

sync_run                                          ← audit trail of sync attempts
  id, started_at, finished_at, status, error_message,
  records_upserted, records_skipped
```

### Sync semantics

- **Full sync.** Each run fetches the complete Inventory snapshot and upserts it in one SQLite transaction. Safer than an `updated_at` cursor until the Inventory API guarantees one.
- **Idempotent.** `ON CONFLICT DO UPDATE` for `schedule_request` + `baremetal`. For `schedule_placement`, rows for a given request are deleted and re-inserted inside the same transaction.
- **Soft-delete.** Requests missing from the latest Inventory response get `deleted_at` set; history is preserved. Baremetals are never soft-deleted (they are snapshots).
- **Parse drift.** Every Raw record is `safeParse`-ed; failures are logged and counted in `records_skipped`, never block the batch.
- **Single-flight.** Concurrent `runSync()` calls (periodic + manual) await the same in-flight promise.
- **Periodic trigger.** `src/instrumentation.ts` registers a `setInterval(5 min)` guarded by `globalThis` (HMR-safe). Short-circuits on `process.env.VERCEL` — deploy to Vercel with Vercel Cron hitting `/api/sync` instead.

### Getting started

**Prerequisites**
- Node.js 20+ (npm ships with it)
- Build toolchain for `better-sqlite3` native binding — on Linux / WSL: `python3` + `build-essential`

**First run**
```bash
npm install
npm run db:migrate   # creates ./data/schedview.db + schema
npm run db:seed      # optional — triggers one sync via the mock Inventory
npm run dev          # http://localhost:3000
```

The dev server also auto-runs a sync on boot and every 5 minutes thereafter — the seed step above is really only for reproducibility / offline testing.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (instrumentation fires sync on boot) |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio (visual DB browser) |
| `npm run db:seed` | Trigger one `runSync()` (uses `INVENTORY_MODE=mock` by default) |
| `npm test` | Vitest (no specs yet) |

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `INVENTORY_MODE` | `mock` | `mock` uses the deterministic seed-42 generator; `http` uses `inventory-client.http.ts` |
| `INVENTORY_BASE_URL` | — | Required when `INVENTORY_MODE=http` |
| `INVENTORY_API_KEY` | — | Optional bearer token for the real Inventory API |
| `DATABASE_PATH` | `./data/schedview.db` | SQLite file location |
| `NEXT_PUBLIC_SCHEDULER_API` | `/api` | Client-side base URL for the Route Handlers |

### Switching to the real Inventory API

1. Set `INVENTORY_MODE=http` and `INVENTORY_BASE_URL` (plus `INVENTORY_API_KEY` if auth is bearer-style).
2. Edit `src/lib/inventory-client.http.ts` — fill in the `TODO(contract)` paths for `listScheduleRequests` and `listBaremetals`.
3. If the real responses don't match the Zod schemas in `src/lib/inventory-types.ts`, either loosen the schemas or add an adapter inside the HTTP client so the sync layer keeps seeing the expected shape.
4. Restart the dev server. The first boot-time sync will populate the DB from the real source.

### Directory map

```
src/
├── app/                     ← Next.js routes
│   ├── api/                 ← Route Handlers (4 endpoints)
│   ├── layout.tsx           ← fonts + <Providers>
│   ├── providers.tsx        ← QueryClient + Toaster
│   ├── page.tsx             ← mounts <ScheduleRequestDashboard>
│   └── globals.css          ← Tailwind v4 @theme tokens
├── db/                      ← Drizzle schema + migrations + client
├── features/scheduler/      ← UI module (migrated from codegen/)
│   ├── types.ts             ← API Zod schemas (SchedulePlacement first-class)
│   ├── lib/{api,format}.ts
│   ├── hooks/useScheduleRequests* ← TanStack Query hooks
│   └── components/          ← UI primitives + dashboard panels
├── lib/
│   ├── inventory-client.*   ← interface + mock + http stub
│   ├── inventory-types.ts   ← Raw* Zod shapes (from Inventory API)
│   ├── sync.ts              ← runSync() + single-flight lock
│   └── projectors.ts        ← DB row → API shape
└── instrumentation.ts       ← 5-min interval registration
```

### Key design decisions

- **Schedule Placement as a first-class table** (not nested on the request). Gives real FK semantics, queryable history, and a clean split between “request metadata” and “per-VM placement outcome.”
- **Drizzle over Prisma.** Swapping SQLite → Postgres later means editing only `src/db/schema.ts` (and `client.ts`); query code stays the same.
- **Zod-validated at every boundary.** Every response from the Inventory API is `safeParse`-ed on the server; every Route Handler response is `.parse`-ed on the client. Schema drift surfaces at the network edge instead of quietly breaking UI rendering.
- **No business logic in the client.** The dashboard doesn't fan out N+1 queries for baremetals — `GET /placement` returns a pre-joined result.

### Known limitations

- The real Inventory API contract is not wired in yet. The HTTP client is a stub; the mock generator feeds everything by default.
- No test suite yet — Vitest is installed, specs TBD.
- `CLAUDE.md` still carries the generic template boilerplate; it does not describe the current architecture.

---

## 繁體中文

### 概觀

SchedView 把 scheduler 產出的調度結果（**Schedule Request → Schedule Placement**）視覺化成一個可查詢的儀表板。資料源是內部 **Inventory API**，瀏覽器無法直接存取；SchedView 在伺服器端扮演橋接角色，定期（以及按需）從 Inventory API 拉資料、寫入本地 SQLite，並透過 Next.js React UI 呈現。

### 系統架構

三層結構，每層有清楚的介面邊界（詳細 ASCII 圖見上方英文版）。

- **UI 層** — `src/app/`、`src/features/scheduler/`：Next.js App Router + React 19 + Tailwind v4 + TanStack Query。所有 fetch 回來的資料都經過 Zod 驗證。
- **API 層** — `src/app/api/`：4 個 Route Handler。列表、單筆詳細（預先 join）、手動 sync、sync 狀態查詢。
- **Sync + DB 層** — `src/lib/sync.ts` + `src/db/`：Drizzle ORM + better-sqlite3。5 分鐘週期由 `src/instrumentation.ts` 註冊，用 single-flight lock 避免重覆執行。
- **Inventory Client 抽象層** — `src/lib/inventory-client.*.ts`：以介面分隔真實 HTTP 實作與 mock。預設 `INVENTORY_MODE=mock` 讓專案開箱即可跑。

### 資料模型

```
schedule_request (1) ──< (N) schedule_placement (0..1) ──> baremetal
                                                            （snapshot，
                                                             best-effort join）
```

- `schedule_request` 保留 `deleted_at` 做軟刪除——Inventory 端移除的申請單在 DB 仍可查詢歷史。
- `schedule_placement` 是一筆 VM→BM 映射（符合您最初描述的「FK 關聯獨立實體」），以 `schedule_request_id` FK `ON DELETE CASCADE`。
- `baremetal` 是拍照式 snapshot；不做 FK 因為真實機器可能下線後仍有歷史申請單引用。
- `sync_run` 紀錄每次 sync 的開始/結束時間、狀態、跳過 / 寫入數量——前端 Sync Now 按鈕會讀這張表。

### Sync 行為

- **Full sync**：每次拉完整的 Inventory 快照、一次交易內 upsert 全部資料。Inventory 尚未保證 `updated_at` 前，先採完整同步比較安全。
- **Idempotent**：`ON CONFLICT DO UPDATE`（request / baremetal）；placement 以「刪除該 request 所有 placement，再整批 insert」保證一致性。
- **軟刪除**：本次 Inventory 回傳中不存在的 request，被標記 `deleted_at`（baremetal 不做軟刪除）。
- **Schema drift 容錯**：每筆 raw record 都經過 `safeParse`，失敗的被 log 並計入 `records_skipped`，不會炸掉整批。
- **Single-flight**：同時觸發的 `runSync()`（週期 vs 手動）會共用同一個 in-flight Promise。
- **週期觸發**：`src/instrumentation.ts` 註冊 `setInterval(5 分鐘)`，用 `globalThis` 守住避免 HMR 疊加。部署到 Vercel 時會自動跳過 setInterval，改用 Vercel Cron 打 `/api/sync`。

### 快速啟動

**前置條件**
- Node.js 20+（npm 隨附）
- `better-sqlite3` 需要 native build——Linux / WSL 請裝 `python3` 與 `build-essential`

**首次執行**
```bash
npm install
npm run db:migrate   # 建立 ./data/schedview.db 與 schema
npm run db:seed      # 選配：用 mock Inventory 灌一次資料
npm run dev          # http://localhost:3000
```

Dev server 啟動時會自動跑一次 sync，之後每 5 分鐘再跑。`npm run db:seed` 主要是給離線 / 可重現性測試用。

### 常用指令

| 指令 | 作用 |
|---|---|
| `npm run dev` | 啟動開發伺服器（同時啟動週期 sync worker）|
| `npm run build` | 正式 build |
| `npm start` | 執行 build 產物 |
| `npm run lint` / `npm run typecheck` | Lint 與 TypeScript 型別檢查 |
| `npm run db:generate` | 從 `schema.ts` 產出 SQL migration |
| `npm run db:migrate` | 套用未執行的 migration |
| `npm run db:studio` | Drizzle Studio（DB 視覺化工具）|
| `npm run db:seed` | 觸發一次 `runSync()`（預設 `INVENTORY_MODE=mock`）|
| `npm test` | Vitest（目前尚無測試檔）|

### 環境變數

| 變數 | 預設值 | 說明 |
|---|---|---|
| `INVENTORY_MODE` | `mock` | `mock` 用內建生成器；`http` 打真實 API |
| `INVENTORY_BASE_URL` | — | `INVENTORY_MODE=http` 時必填 |
| `INVENTORY_API_KEY` | — | Optional Bearer token |
| `DATABASE_PATH` | `./data/schedview.db` | SQLite 檔案路徑 |
| `NEXT_PUBLIC_SCHEDULER_API` | `/api` | 前端呼叫 Route Handler 的 base URL |

### 切換到真實 Inventory API

1. 設 `INVENTORY_MODE=http`、`INVENTORY_BASE_URL`（若需 auth 另加 `INVENTORY_API_KEY`）。
2. 編輯 `src/lib/inventory-client.http.ts`，把 `TODO(contract)` 標記的 path 換成實際 endpoint。
3. 若真實 API 回傳的欄位和 `src/lib/inventory-types.ts` 的 Zod schema 不同，兩種做法擇一：
   - 放寬 / 修改 Zod schema（能直接對上就直接改）
   - 在 HTTP client 裡加 adapter，把真實 response 轉成 `RawScheduleRequest` / `RawBaremetal` 的形狀
4. 重啟 dev server。啟動時的首次 sync 會從真實 Inventory 填入 DB。

### 目錄結構

（完整版見上方英文 "Directory map" 區塊，不重複）

關鍵目錄一行速查：
- `src/app/` → Next.js 路由（頁面 + API Route Handlers）
- `src/db/` → Drizzle schema / migrations / client
- `src/features/scheduler/` → UI 模組（原 `codegen/` 搬過來並重構）
- `src/lib/` → Inventory client、sync worker、projectors
- `src/instrumentation.ts` → 5 分鐘週期 sync 註冊點

### 主要設計決策

- **Schedule Placement 作為獨立 table**：不塞在 request JSON 裡——取得真正的 FK 語意、可查歷史、乾淨分離「申請單 metadata」與「VM 放置結果」。
- **Drizzle 而非 Prisma**：未來要換 Postgres 只需改 `src/db/schema.ts`（和 `client.ts`），查詢程式完全不動。
- **邊界都用 Zod 驗證**：Inventory → 伺服器、Route Handler → 瀏覽器，兩處都做 parse。Schema drift 會在網路邊界立刻炸出錯誤，而不是默默讓 UI 壞掉。
- **Pre-joined PlacementResult**：dashboard 一次拿齊 request + placements + baremetals，不做 N+1 請求。

### 現狀限制

- 真實 Inventory API 尚未接上（contract 未定）。HTTP client 是 stub，預設走 mock。
- 尚未有測試；`vitest` 已安裝，spec 待補。
- `CLAUDE.md` 目前仍是 template 產生的樣板文字，未反映實際架構。
