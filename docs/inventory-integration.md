# Inventory API 整合指南 / Inventory API Integration Guide

> 給接手這個專案的工程師：你即將把 SchedView 後端從「預設 mock」切換成「打真實 Inventory API」。這份文件是 step-by-step 指南，涵蓋從理解現況、編寫 adapter、到 deploy 前 checklist 的全部流程。

---

## 本文件範圍

- **目標讀者**：有 TypeScript / Next.js 基礎，但剛接手 SchedView 的工程師。
- **前置閱讀**：`README.md` 的 Architecture + Sync semantics 兩節。
- **目標**：完成「切換到真實 Inventory API」並讓 `npm run dev` 開出的 dashboard 顯示真實資料。
- **不涵蓋**：Inventory API 本身的設計／部署；SchedView 的 UI 改動；DB schema 大改（見 §7 延伸路線）。

---

## 快速地圖：你會動到哪些檔案？

```
真實 Inventory API（內部）
        │ HTTP
        ▼
┌──────────────────────────────────────┐
│ src/lib/inventory-client.http.ts     │ ← 90% 的改動在這裡
│  · endpoint 路徑                      │
│  · auth header                        │
│  · pagination loop                    │
│  · field-name adapter（若需要）       │
└───────────────┬──────────────────────┘
                │ 回傳 RawScheduleRequest[] / RawBaremetal[]
                ▼
┌──────────────────────────────────────┐
│ src/lib/inventory-types.ts           │ ← Zod schema = 你的型別契約
│  · 若 Inventory 的 field 能對齊       │
│    就維持不動                         │
│  · 若 enum / optional 差異較大       │
│    需微調                             │
└───────────────┬──────────────────────┘
                │ 經 Zod safeParse 驗證
                ▼
┌──────────────────────────────────────┐
│ src/lib/sync.ts                      │ ← 正常情況不用動
│  · 呼叫 InventoryClient interface    │
│  · 轉交易寫入 DB                      │
└──────────────────────────────────────┘
```

**心智模型**：`InventoryClient` 是一個 interface（`src/lib/inventory-client.ts`）。interface 上方（sync.ts、Route Handler、UI、DB）完全不關心你怎麼實作它；interface 下方（HTTP client）把 Inventory 的真實 response 轉成承諾的 Raw* 形狀。

> **實務通則**：你應該盡量把「外部 API 的怪癖」**吸收在 `inventory-client.http.ts` 裡**，維持 `sync.ts` 以上的程式碼不動。Adapter 模式的價值就在這裡。

---

## 階段 0：開工前

1. 讀完 `README.md`（特別是 Architecture 與 Sync semantics 兩節）。
2. `npm run dev` 跑起來確認 mock 模式一切正常（dashboard 應該有 20 筆 request、15 台 BM）。
3. 開啟以下幾個檔案，對照著看：
   - `src/lib/inventory-types.ts`（SchedView 期望的形狀）
   - `src/lib/inventory-client.ts`（interface）
   - `src/lib/inventory-client.http.ts`（你要改的目標檔）
   - `src/lib/inventory-client.mock.ts`（拿來比對 — 「合法」的回傳長這樣）
4. 準備一個 Inventory API 的 sandbox / dev 環境，以及一組你可以打的 credentials。

---

## 階段 1：把 Inventory API 的 contract 寫下來

**動手寫 code 前**，先花 30 分鐘把 Inventory API 的規格寫成一張簡表。這一步看起來像拖延，但直接影響你第 2 階段的決策速度。

建議格式（可以寫在這份文件旁邊的 scratch notes）：

```md
### Inventory API spec

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/schedule-requests` | GET | 列出所有 schedule requests |
| `/v1/schedule-requests/{id}` | GET | 取單筆（含 VM 列表） |
| `/v1/baremetals` | GET | 列出所有 baremetals |

### Auth
- API Key via `X-Api-Key` header

### Pagination
- `/schedule-requests` 支援 cursor：query `?cursor=<base64>&limit=100`
- response header `X-Next-Cursor: <base64>` 為下一頁 cursor
- 無下一頁時 header 不存在

### Response 範例（`/schedule-requests`）
{
  "data": [
    {
      "request_id": "req-0001",           ← 注意：不是 id
      "cluster": { "id": "cluster-prod-1" },  ← 注意：巢狀
      "submitted": "2026-04-23T12:34:56Z",    ← 注意：ISO 字串
      ...
    }
  ]
}

### 欄位差異（對照 RawScheduleRequest）
- `request_id` → `id`
- `cluster.id` → `cluster_id`
- `submitted`（ISO） → `submitted_at`（Unix ms）
- `vm_list` → `vms`
- ...
```

這張表直接指引你接下來要走的路線（§2）。

---

## 階段 2：選擇 schema 對齊策略

你會落在三種情境之一。先判斷你在哪一種，避免過度工程。

### 情境 A：**完全對齊**

Inventory 回傳的每個欄位、巢狀結構、時間格式、enum 值，都跟 `src/lib/inventory-types.ts` 定義的 `RawScheduleRequest` / `RawBaremetal` 一模一樣。

**動作**：只改 `inventory-client.http.ts` 的 path 跟 auth。不碰 types，不碰 sync。整趟工作大概 30 分鐘。

### 情境 B：**結構對齊，欄位名不同**

Inventory 的 shape 看起來像我們想要的（有 request → vms 的層次、有 total_capacity / used_capacity 的分拆），但欄位名稱或 enum 值不一樣。例如 `request_id` vs `id`、`cluster` 是物件而非字串、時間是 ISO 字串而非 Unix ms。

**動作**：在 `inventory-client.http.ts` 裡寫一個小型 adapter（純 function），把 Inventory response 轉成 `RawScheduleRequest` / `RawBaremetal`。Types 不動，sync 不動。

這是**最常見的情境**，也是 adapter 模式最漂亮的地方 — 你把所有噁心的 field-rename 邏輯集中在一個地方，上層完全不受影響。

### 情境 C：**結構本質不同**

例如：
- Inventory 把 placements 放在獨立的 endpoint（`/requests/:id/placements`），而不是塞在 request 的 `vms` 陣列裡。
- Inventory 沒有 `used_capacity`，只有歷史總用量紀錄。
- Baremetal 的 topology 欄位完全不同（多個維度 / 少幾個維度）。

**動作**：兩種選擇，依程度選一個：

- **選項 C1**：在 HTTP client 裡做更重的 stitching — 多打幾個 endpoint、在 adapter 內組裝成 `RawScheduleRequest`。`inventory-types.ts` 完全不動。大部分情況這是正解。
- **選項 C2**：承認 SchedView 的內部模型不適合，去改 `inventory-types.ts`、`sync.ts`、`projectors.ts`、可能還有 `schema.ts`（DB）跟 UI。這是**上次手段** — 只在你確定 Inventory 的模型才是對的、SchedView 原設計錯了時才走。

> 新手很容易不小心走 C2。如果你發現自己在改 `sync.ts`，停下來想一下：能不能把差異吸收在 adapter 裡？90% 的答案是「可以」。

---

## 階段 3：情境 A 的具體動作（完全對齊）

這是最簡單的路線。直接打開 `src/lib/inventory-client.http.ts`，目前長這樣：

```ts
// src/lib/inventory-client.http.ts
import type { InventoryClient } from './inventory-client';
import type { RawBaremetal, RawScheduleRequest } from './inventory-types';

export function createHttpInventoryClient(): InventoryClient {
  const base = process.env.INVENTORY_BASE_URL;
  if (!base) {
    throw new Error(/* ... */);
  }
  const authHeader: Record<string, string> = process.env.INVENTORY_API_KEY
    ? { authorization: `Bearer ${process.env.INVENTORY_API_KEY}` }
    : {};

  async function getJson<T>(path: string): Promise<T> {
    // ... fetch + error handling + 30s timeout
  }

  return {
    async listScheduleRequests() {
      // TODO(contract): confirm path + pagination.
      return getJson<RawScheduleRequest[]>('/schedule-requests');
    },
    async listBaremetals() {
      // TODO(contract): confirm path.
      return getJson<RawBaremetal[]>('/baremetals');
    },
  };
}
```

**要改的地方**：

1. **Endpoint 路徑**：把 `/schedule-requests` 跟 `/baremetals` 換成真實路徑，例如 `/v1/schedule-requests`、`/v1/baremetals`。
2. **Auth header**：目前預設是 `Authorization: Bearer <key>`。若 Inventory 用別的 header（例如 `X-Api-Key`），改掉：
   ```ts
   const authHeader: Record<string, string> = process.env.INVENTORY_API_KEY
     ? { 'x-api-key': process.env.INVENTORY_API_KEY }
     : {};
   ```
3. **移除 `TODO(contract)` 註解**（代表這個 endpoint 已確認）。

**設定環境變數**（`.env.local`）：

```bash
INVENTORY_MODE=http
INVENTORY_BASE_URL=https://inventory.internal.example.com
INVENTORY_API_KEY=xxxxxxxxxxxx
```

**跑起來驗證**：

```bash
npm run db:seed      # 觸發一次 runSync
# 或直接：
INVENTORY_MODE=http npm run dev
```

Postgres 會被填入真實資料（`docker exec -it schedview-pg psql -U schedview -c 'SELECT count(*) FROM schedule_request;'` 可以快速驗）。前往 http://localhost:3000 確認 dashboard 長得對。若 sync 失敗（例如 schema 驗證失敗），看 console 的 `[sync] skipping invalid ...` log — 這通常代表你其實在情境 B，不是 A。

---

## 階段 4：情境 B 的具體動作（欄位名不同）

### 4.1 設計 adapter

目標：HTTP client 的 `listScheduleRequests()` / `listBaremetals()` 對外仍回傳 `RawScheduleRequest[]` / `RawBaremetal[]`，但內部先打真實 API、再把 response 轉成我們想要的形狀。

建議結構：

```ts
// src/lib/inventory-client.http.ts
import type { InventoryClient } from './inventory-client';
import type { RawBaremetal, RawScheduleRequest } from './inventory-types';

// ─── 1. 定義 Inventory 真實回傳的形狀（僅在此檔內用） ────
interface InventoryApiRequest {
  request_id: string;
  cluster: { id: string };
  submitted: string;              // ISO-8601 string
  solver: { status: string; time_seconds: number };
  vm_list: Array<{
    vm_id: string;
    resources: { cpu: number; memory_mib: number; disk_gib: number; gpu?: number };
    role: string;
    placed_on?: string | null;
  }>;
  unplaced: number;
  requested_by: string;
  failure_reason: string | null;
}

interface InventoryApiBaremetal {
  bm_id: string;
  capacity: {
    total: { cpu: number; memory_mib: number; disk_gib: number };
    used:  { cpu: number; memory_mib: number; disk_gib: number };
  };
  location: {
    site: string; phase: string; dc: string;
    rack: { name: string; unit: number; height: number };
    availability_group: string;
  };
  role: string;
  vm_slots: { max: number; current: number };
  ip_classes: string[];
}

// ─── 2. Adapter：真實 API shape → Raw* shape ───
function adaptRequest(src: InventoryApiRequest): RawScheduleRequest {
  return {
    id: src.request_id,
    cluster_id: src.cluster.id,
    submitted_at: new Date(src.submitted).getTime(),
    status: src.solver.status as RawScheduleRequest['status'],
    solver_status: src.solver.status as RawScheduleRequest['solver_status'],
    solve_time_seconds: src.solver.time_seconds,
    vms: src.vm_list.map((v) => ({
      id: v.vm_id,
      demand: {
        cpu_cores: v.resources.cpu,
        memory_mb: v.resources.memory_mib,
        disk_gb: v.resources.disk_gib,
        gpu_count: v.resources.gpu ?? 0,
      },
      node_role: v.role as RawScheduleRequest['vms'][number]['node_role'],
      assigned_bm: v.placed_on ?? null,
    })),
    unplaced_count: src.unplaced,
    requested_by: src.requested_by,
    reason: src.failure_reason,
  };
}

function adaptBaremetal(src: InventoryApiBaremetal): RawBaremetal {
  return {
    id: src.bm_id,
    total_capacity: {
      cpu_cores: src.capacity.total.cpu,
      memory_mb: src.capacity.total.memory_mib,
      disk_gb: src.capacity.total.disk_gib,
      gpu_count: 0,
    },
    used_capacity: {
      cpu_cores: src.capacity.used.cpu,
      memory_mb: src.capacity.used.memory_mib,
      disk_gb: src.capacity.used.disk_gib,
      gpu_count: 0,
    },
    topology: {
      site: src.location.site,
      phase: src.location.phase,
      datacenter: src.location.dc,
      rack: src.location.rack.name,
      unit: src.location.rack.unit,
      rack_height: src.location.rack.height,
      ag: src.location.availability_group,
    },
    bm_role: src.role as RawBaremetal['bm_role'],
    max_vm_count: src.vm_slots.max,
    current_vm_count: src.vm_slots.current,
    ip_types: src.ip_classes as RawBaremetal['ip_types'],
  };
}

// ─── 3. Client 本體 ───
export function createHttpInventoryClient(): InventoryClient {
  const base = process.env.INVENTORY_BASE_URL!;
  // ... auth, getJson<T>() helper（同原檔）

  return {
    async listScheduleRequests() {
      const res = await getJson<{ data: InventoryApiRequest[] }>('/v1/schedule-requests');
      return res.data.map(adaptRequest);
    },
    async listBaremetals() {
      const res = await getJson<{ data: InventoryApiBaremetal[] }>('/v1/baremetals');
      return res.data.map(adaptBaremetal);
    },
  };
}
```

### 4.2 關鍵實務點

- **Adapter 是純 function**：易測試、沒有 side effect。建議直接在 file 內 `export` 它們（至少用 `@internal` 註解），方便單元測試匯入。
- **時間格式**：`new Date('2026-04-23T12:34:56Z').getTime()` 一行解決 ISO → Unix ms。若 Inventory 給的是 timezone-less string，要小心解讀；可用 `dayjs` 或手動 parse。
- **Enum 轉換**：若 Inventory 的 enum 跟 SchedView 不同（例如 Inventory 用 `"SOLVED"` 代表 `"OPTIMAL"`），在 adapter 裡做映射表，不要硬 cast：
  ```ts
  const STATUS_MAP: Record<string, RawScheduleRequest['status']> = {
    SOLVED: 'OPTIMAL',
    PARTIAL: 'FEASIBLE',
    FAILED: 'INFEASIBLE',
    /* ... */
  };
  status: STATUS_MAP[src.solver.status] ?? 'UNKNOWN',
  ```
- **Optional 欄位**：Inventory 某些欄位是 optional（例如 `gpu`），adapter 要補預設值。這跟 Zod schema 的 `.default(0)` 是兩層保護，各自獨立。
- **不要把 adapter 放進 `inventory-types.ts`**：那個檔的角色是「SchedView 內部契約」，不該知道外部 API 長什麼樣。

### 4.3 驗證 adapter

`safeParse` 是你的護身符。sync.ts 的 parse 失敗不會炸掉整批，只會 log 並計入 `records_skipped`。所以切 HTTP 模式第一次跑完後，務必看：

```bash
npm run dev
# 找 log：
#   [sync] skipping invalid ScheduleRequest: [...]
#   [sync] skipping invalid Baremetal: [...]
```

若有跳過的紀錄，看 Zod error issues 的 `path` — 告訴你哪個欄位對不上。常見：
- enum 值不在列舉內（`Invalid enum value. Expected 'worker' | 'master' ..., received 'WORKER_NODE'`）
- 數字是字串（`Expected number, received string`）→ adapter 裡 `Number(...)`
- required 欄位是 `undefined`（→ adapter 漏補了）

確認所有 records 都通過 Zod 後，再做 UI 驗證（dashboard 顯示正常、點進去看到 placement map）。

---

## 階段 5：情境 C — 結構差異較大

### 5.1 子情境：Placement 在獨立 endpoint

**狀況**：Inventory 有
- `GET /v1/schedule-requests` → 回 request metadata（沒有 VMs）
- `GET /v1/schedule-requests/:id/placements` → 回該 request 的 placements

**解法**：在 adapter 內做 stitching，對外仍然回傳「內嵌 vms 的 RawScheduleRequest」：

```ts
async listScheduleRequests() {
  const { data: metas } = await getJson<{ data: InventoryApiRequestMeta[] }>(
    '/v1/schedule-requests',
  );
  const withPlacements = await Promise.all(
    metas.map(async (m) => {
      const { data: placements } = await getJson<{ data: InventoryApiPlacement[] }>(
        `/v1/schedule-requests/${m.request_id}/placements`,
      );
      return adaptRequest(m, placements);
    }),
  );
  return withPlacements;
}
```

**警告**：
- 若 metas 有幾百筆，並行打 N+1 請求可能壓垮 Inventory。加 concurrency limit（例如 `p-limit` 套件或自己寫 10 筆一組的 batch）。
- 考慮在 Inventory 側推動新增「bulk placements endpoint」（e.g., `POST /v1/placements/batch { ids: [...] }`）— 長遠來說對雙方都比較健康。

### 5.2 子情境：Capacity 不是 snapshot，是 event stream

**狀況**：Inventory 不給「目前 used」，給「歷史使用事件」（insert/delete timestamps）。你要自己算目前狀態。

**解法**：兩個選項——

- 若 event 量小：在 adapter 裡 fold 出目前值，對外仍回傳符合 `RawBaremetal` 的 `used_capacity`。
- 若 event 量大：這真的不是 SchedView 的工作。推回 Inventory 側要求提供 snapshot endpoint。

### 5.3 子情境：Topology 維度不同

若 Inventory 的 topology 沒有 `phase` 或多了一個 `zone` 欄位：

- 缺少的：adapter 填固定值（例如 `phase: 'unknown'`），並在 README 備註。或更新 Zod schema 把這個欄位改成 optional。
- 多出來的：直接 drop（忽略）。若 UI 確實會用，才去更新 Zod schema 與 UI 元件。

### 5.4 何時該進 C2（改 Zod + sync + DB）？

真的別輕易走這條。觸發條件：

1. 你發現 adapter 代碼量已經超過 HTTP client 本體（>200 行 adapter 邏輯），代表模型根本不 fit。
2. Inventory 有欄位 SchedView 需要展示但現有 DB schema 存不下。
3. 你要做的「sync 語意」本質不同（e.g., pull → push，或雙向同步）。

走 C2 時，依序：

1. 更新 `src/lib/inventory-types.ts` 的 Raw schemas。
2. 更新 `src/lib/sync.ts` 的 `upsertBaremetal` / `upsertRequest` 函數。
3. 若需要新欄位：更新 `src/db/schema.ts`，跑 `npm run db:generate` + `npm run db:migrate`。
4. 更新 `src/lib/projectors.ts` 把新欄位映射到 API response shape。
5. 更新 `src/features/scheduler/types.ts` 的客戶端 schema。
6. 更新 UI 元件使用新欄位。

這條路每個 step 都要跑 `npm run typecheck` + `npm run build`，編譯器會抓出多數疏漏。

---

## 階段 6：常見變體

### 6.1 分頁（Pagination）

**Cursor-based**（推薦，常見於現代 API）：

```ts
async listScheduleRequests() {
  const all: InventoryApiRequest[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=200` : '?limit=200';
    const { data, next_cursor } = await getJson<{
      data: InventoryApiRequest[];
      next_cursor?: string;
    }>(`/v1/schedule-requests${qs}`);
    all.push(...data);
    cursor = next_cursor;
  } while (cursor);
  return all.map(adaptRequest);
}
```

**Offset-based**：

```ts
let offset = 0;
const limit = 200;
while (true) {
  const { data } = await getJson<{ data: T[] }>(
    `/v1/.../?offset=${offset}&limit=${limit}`,
  );
  if (data.length === 0) break;
  all.push(...data);
  offset += limit;
}
```

**Page-number based**：類似 offset，但 param 是 `page=N`。邏輯相同。

### 6.2 驗證 / 認證

- **API Key in header**（最常見）：
  ```ts
  headers: { 'x-api-key': process.env.INVENTORY_API_KEY }
  ```
- **Bearer token**（預設模板）：已如此實作，直接沿用。
- **OAuth2 client credentials**：需先打 token endpoint，快取 token（含 expiry）。建議做成獨立 function：
  ```ts
  let tokenCache: { value: string; expiresAt: number } | null = null;
  async function getToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
    const res = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.INVENTORY_CLIENT_ID!,
        client_secret: process.env.INVENTORY_CLIENT_SECRET!,
      }),
    });
    const { access_token, expires_in } = await res.json();
    tokenCache = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
    return access_token;
  }
  ```
- **mTLS**：Next.js 的 fetch 不直接支援 client cert。要在 server-side 用 `node:https.Agent` + `undici`。這需要比較多改動，有需要再說。

### 6.3 Rate limit

若 Inventory 有速率限制：

- 全量同步頻率（目前 5 分鐘）可能需要調整。在 `src/instrumentation.ts` 改 interval。
- 若 per-request rate limit 嚴格，stitch 邏輯（§5.1）要加 concurrency control（`p-limit`）。
- 考慮在 `getJson` 加 simple retry with exponential backoff（僅限 429 / 5xx）：
  ```ts
  async function getJson<T>(path: string, attempt = 0): Promise<T> {
    const res = await fetch(/* ... */);
    if (res.status === 429 && attempt < 3) {
      const wait = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return getJson<T>(path, attempt + 1);
    }
    // ... normal handling
  }
  ```

### 6.4 Timestamps

Inventory 常回傳 ISO 字串；DB 儲存 Unix ms。

```ts
// ISO → Unix ms
new Date(iso).getTime()          // NaN if parse fails — 可以加保護
+new Date(iso)                    // 簡潔版

// Unix s → Unix ms
unixSeconds * 1000

// Unix ms → ISO（UI 不太需要，但 debug 可能）
new Date(unixMs).toISOString()
```

若 Inventory 用 timezone-less 字串（`2026-04-23 12:34:56`）要小心：`new Date()` 會解讀成 local time，跨環境會出錯。建議在 adapter 裡強制加 `Z` 視為 UTC，或用 `dayjs(str, 'YYYY-MM-DD HH:mm:ss', true).utc().valueOf()`。

### 6.5 部分失敗

Inventory 回 200 但資料不完整 / partial 是常態。SchedView 的 sync 層已處理：

- `safeParse` 失敗 → log + 計入 `records_skipped`，不中斷 batch。
- 整個 fetch timeout / 5xx → 整次 sync fail，DB 不動（transaction rollback 之前），`sync_run` 記錄 `status: 'failed'` + `error_message`。

你不需要額外寫容錯邏輯。**但 adapter 應該容錯**：

```ts
function adaptRequest(src: InventoryApiRequest): RawScheduleRequest {
  try {
    return { /* ... */ };
  } catch (err) {
    throw new Error(`adapt failed for request ${src?.request_id}: ${err}`);
  }
}
```

這樣 Zod 驗證失敗時訊息更 actionable。

---

## 階段 7：Sync 行為層面的調整

HTTP 切換後，若你發現 sync 本身的行為需要調整，對照這張表：

| 情境 | 位置 | 做法 |
|---|---|---|
| 全量太慢／太貴 | `sync.ts` | 改 incremental：在 `createInventoryClient().listScheduleRequests({ since })` 傳入上次 `sync_run.finished_at`。需要 Inventory 支援 `since` query param |
| 5 分鐘太頻繁 | `src/instrumentation.ts` | 改 `setInterval` 數值 |
| 要暫停 periodic sync（debug 時） | `src/instrumentation.ts` | 加 `if (process.env.DISABLE_SYNC_WORKER) return;` |
| 想看 sync 歷史 | DB | `SELECT * FROM sync_run ORDER BY id DESC LIMIT 20;` 或 `npm run db:studio` |
| 要加「最後成功時間」UI | `SyncNowButton.tsx` + `/api/sync/status` | 已實作，讀 `last.finished_at` |
| Inventory 掛了想看到 UI 上的警示 | `SyncNowButton.tsx` | `last.status === 'failed'` 時改紅色按鈕；`title` attr 顯示 `error_message` |

### 7.1 切 incremental sync

目前全量，理由：Inventory 尚未承諾 `updated_at` 語意。如果未來承諾了：

```ts
// src/lib/inventory-client.ts
export interface InventoryClient {
  listScheduleRequests(opts?: { since?: number }): Promise<RawScheduleRequest[]>;
  // ...
}

// src/lib/sync.ts — 改 doSync() 裡：
const lastRun = db.select().from(syncRun)
  .where(eq(syncRun.status, 'success'))
  .orderBy(desc(syncRun.finishedAt))
  .limit(1).all()[0];

const rawRequests = await client.listScheduleRequests({
  since: lastRun?.finishedAt ?? undefined,
});
```

注意：increment 後 soft-delete 邏輯要重新思考 — 你不再拿得到「完整清單」，沒辦法標記消失的 requests。可能需要 Inventory 提供「已刪除 ID」的 endpoint，或接受一段時間內軟刪除語意暫時失效。

---

## 階段 8：Pre-deploy Checklist

切到 production 之前，逐項勾掉：

- [ ] `INVENTORY_MODE=http` 已設在部署環境
- [ ] `INVENTORY_BASE_URL` 指向對的環境（dev / staging / prod）
- [ ] `INVENTORY_API_KEY` 用 secret manager 管理（不是 plain env）
- [ ] `DATABASE_URL` 指向部署環境的 Postgres（dev / staging / prod）；密碼用 secret manager 管理
- [ ] `src/lib/inventory-client.http.ts` 內所有 `TODO(contract)` 已移除
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] 手動 smoke：`INVENTORY_MODE=http npm run db:seed` 成功，`records_skipped === 0`
- [ ] `npm run dev` 起來後 dashboard 正確顯示前 10 筆 request
- [ ] 點 Sync Now 按鈕 → toast 顯示成功
- [ ] `npm run dev` 放著 10 分鐘，觀察 `sync_run` 表多出 2 筆（0 分鐘 + 5 分鐘 + 10 分鐘，含 boot run 可能 3 筆）
- [ ] 部署目標若是 Vercel：設定 Vercel Cron 打 `/api/sync`（因 `instrumentation.ts` 會在 Vercel 環境 skip `setInterval`）
- [ ] `docs/scheduler-module.md` 已更新（若有新增 endpoint 或欄位）

---

## 附錄 A：SchedView 期望的 Raw shape（複習）

這是你的 adapter 必須產出的形狀。權威來源在 `src/lib/inventory-types.ts`。

```ts
RawScheduleRequest = {
  id: string;
  cluster_id: string;
  submitted_at: number;              // Unix ms
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN' | 'MODEL_INVALID';
  solver_status: same as status;     // 目前一律 = status
  solve_time_seconds: number;
  vms: Array<{
    id: string;
    demand: {
      cpu_cores: number;              // > 0
      memory_mb: number;              // > 0
      disk_gb: number;                // > 0
      gpu_count: number;              // >= 0, default 0
    };
    node_role: 'worker' | 'master' | 'infra' | 'l4lb';
    assigned_bm: string | null;       // null = 未放置
  }>;
  unplaced_count: number;            // >= 0
  requested_by: string;
  reason: string | null;             // 失敗原因 / null
};

RawBaremetal = {
  id: string;
  total_capacity: { cpu_cores, memory_mb, disk_gb, gpu_count };
  used_capacity:  { cpu_cores, memory_mb, disk_gb, gpu_count };
  topology: {
    site: string;
    phase: string;
    datacenter: string;
    rack: string;
    unit: number;                    // > 0
    rack_height: number;             // > 0
    ag: string;
  };
  bm_role: 'worker' | 'master' | 'infra' | 'l4lb';
  max_vm_count: number;              // > 0
  current_vm_count: number;          // >= 0
  ip_types: Array<'routable' | 'non-routable'>;
};
```

---

## 附錄 B：DB 寫入點（sync 層）

對照 `src/lib/sync.ts` 中的 `upsertRequest` / `upsertBaremetal`，看 Raw shape 如何落進 DB：

```
RawScheduleRequest.id              → schedule_request.id (PK)
RawScheduleRequest.cluster_id      → schedule_request.cluster_id
RawScheduleRequest.submitted_at    → schedule_request.submitted_at
...

RawScheduleRequest.vms[]           → schedule_placement 多筆（delete-then-insert per request）
  vm.id                            → schedule_placement.vm_id
  vm.demand.cpu_cores              → schedule_placement.vm_cpu_cores
  vm.demand.memory_mb              → schedule_placement.vm_memory_mb
  vm.demand.disk_gb                → schedule_placement.vm_disk_gb
  vm.demand.gpu_count              → schedule_placement.vm_gpu_count
  vm.node_role                     → schedule_placement.node_role
  vm.assigned_bm                   → schedule_placement.assigned_bm_id

RawBaremetal.id                    → baremetal.id (PK)
RawBaremetal.topology.*            → baremetal (flattened columns)
RawBaremetal.total_capacity.*      → baremetal.total_*
RawBaremetal.used_capacity.*       → baremetal.used_*
RawBaremetal.ip_types              → baremetal.ip_types (jsonb)
```

若你的 adapter 改變了 Raw shape（進入 C2 路線），對應要改 `sync.ts` 的 `values` 物件，以及可能的 `projectors.ts`。

---

## 附錄 C：Debugging playbook

### C1. `[sync] skipping invalid ScheduleRequest: [...]`

**意思**：Inventory 回來某筆資料通不過 `RawScheduleRequestSchema.safeParse`。

**排查**：
1. 從 log 裡找 `parsed.error.issues` 的 `path` 陣列，指出壞在哪個欄位。
2. 去 `src/lib/inventory-client.http.ts` 的 adapter，看對應欄位是怎麼產的。
3. 改 adapter（補預設值 / 型別轉換 / enum 映射）。
4. 如果是真正資料髒（例如 Inventory 真的回傳 `unplaced_count: -1`），回報給 Inventory 那邊修；暫時在 adapter 裡 `Math.max(0, src.unplaced)` 治標。

### C2. `Inventory API 500 Internal Server Error at /...`

**意思**：Inventory 自己掛了，或你的 request 讓它炸了。

**排查**：
1. 用 curl / Postman 直接打 endpoint，確認獨立重現。
2. 看 `sync_run` 表的 `error_message`。
3. 若偶發，sync 會在下個 5 分鐘週期重試；不用手動介入。若每次都爆，去找 Inventory 維護者。

### C3. Dashboard 顯示 0 筆 request

**排查順序**：
1. `curl http://localhost:3000/api/schedule-requests` → 有沒有資料？
2. 若 API 有資料，UI 沒顯示：F12 看 Network / Console，可能是前端 Zod parse 失敗（`PlacementResultSchema.parse` 或 `ScheduleRequestSchema.array().parse`）。
3. 若 API 也沒資料：`psql "$DATABASE_URL" -c 'SELECT count(*) FROM schedule_request;'` 看 DB 有沒有資料。
4. 若 DB 是空的：`psql "$DATABASE_URL" -c 'SELECT * FROM sync_run ORDER BY id DESC LIMIT 5;'` 看 sync 有沒有跑成功。
5. 若 sync 沒跑過：確認 `npm run dev` 啟動時 `src/instrumentation.ts` 是否被執行（看 console 有沒有 [sync] log）。

### C4. Sync Now 按鈕一直轉圈

**意思**：前端 poll `/api/sync/status` 時 `in_flight: true` 卡住。

**排查**：
- 看 server 端 log：runSync 是不是 hang 在某個 `await fetch`（Inventory API 超慢 / 未回應）。
- 30 秒 `AbortSignal.timeout` 應該會踢掉，踢掉後 sync_run 會記 `status: 'failed'`，in_flight 會變回 false。
- 若 inventory-client.http.ts 有 pagination loop 且無界：檢查 while 迴圈終止條件。

### C5. 型別錯誤：`Type 'string' is not assignable to type '"worker" | "master" | ...'`

常見於 adapter：你 as-cast 了 Inventory 的 enum 到 Raw 的 enum，但字串不在列舉內。

**正解**：加 whitelist 映射（見 §4.2 enum 轉換）。

---

## 附錄 D：DB 後端歷史與替換策略

SchedView 目前用 **PostgreSQL**（`drizzle-orm/node-postgres`）。早期版本用過 SQLite (`better-sqlite3`)，後來因為兩個需求換掉：

1. **無 native binding 的安裝路徑**：純 JS 的 `pg` driver 可以完整經過企業內網的 Nexus / Artifactory 等 npm 鏡像，不需要從 GitHub releases 抓 prebuild。
2. **多實例部署**：`./data/schedview.db` 的檔案鎖在多 pod 環境會變成瓶頸；Postgres 直接解掉。

`schema.ts` 設計成 dialect-portable，未來真的要換回 SQLite（或換 MySQL）時，動的檔案僅限：

1. 對應 driver：`npm install better-sqlite3` / `mysql2` / 你選的 driver
2. `src/db/schema.ts`：`pgTable` → `sqliteTable` / `mysqlTable`；`bigint({mode:'number'})` → `integer`；`jsonb` → `text({ mode: 'json' })` 或 `json`；`serial()` → 對應自增寫法
3. `src/db/client.ts`：換 driver import 與連線設定
4. `drizzle.config.ts`：`dialect: 'postgresql'` → 對應 dialect
5. `npm run db:generate` 產新 migration；舊的留著不會用到
6. 其他（`sync.ts`、`projectors.ts`、Route Handlers、UI）完全不動

---

## 結語

切換 Inventory API 的核心只有一句話：

> **把「Inventory 的怪癖」吸收在 `inventory-client.http.ts` 裡；sync 層、DB、UI 不應該感覺到你換了 backend。**

Adapter 模式的目的就是讓「換 Inventory 實作」這種事變成「改一個檔」而非「改 20 個檔」。當你發現自己在 `sync.ts`、`schema.ts`、或 UI 元件裡改東西時，停下來問自己：能不能在 HTTP client 裡收掉？90% 答案是 yes。

有問題直接看 `docs/scheduler-module.md`（原始 design handoff）或 `README.md` 的 Architecture。
