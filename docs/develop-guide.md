# Develop Guide

寫給 Python 背景的工程師。用 FastAPI / SQLAlchemy / Pydantic 的心智模型對照 SchedView 的 TS stack，幫助快速上手。

---

## 1. Stack 對照表

| 用途 | Python 生態 | SchedView (TS) |
|---|---|---|
| Web framework | FastAPI / Flask | **Next.js 16** (App Router, API routes) |
| ORM | SQLAlchemy / SQLModel | **Drizzle ORM** |
| Migration | Alembic | **drizzle-kit** |
| Schema validation | Pydantic | **Zod** |
| HTTP client (server) | httpx / requests | **fetch** (built-in) |
| Server state (前端) | — | **TanStack Query** (React Query) |
| Test runner | pytest | **Vitest** |
| Lint / format | ruff / black | **ESLint** + TypeScript |
| Script runner | `python script.py` | **tsx** (`tsx src/db/seed.ts`) |
| Toast / notify | — | **sonner** |
| CSS | (n/a) | **Tailwind v4** + clsx |

---

## 2. 目錄結構

```
src/
├── app/                         # Next.js App Router (路由 = 資料夾)
│   ├── api/                     # ← 等同 FastAPI 的 router 集合
│   │   ├── schedule-requests/
│   │   │   ├── route.ts         # GET /api/schedule-requests
│   │   │   └── [id]/            # 動態路由 (= /{id} path param)
│   │   └── sync/
│   │       ├── route.ts         # POST /api/sync
│   │       └── status/route.ts
│   ├── layout.tsx               # 全站外框 (header/footer/providers)
│   ├── page.tsx                 # 首頁 (/)
│   └── providers.tsx            # React Query / toast provider 注入點
├── db/                          # ← 等同 Python 的 models/ + alembic/
│   ├── client.ts                # DB connection pool (singleton)
│   ├── schema.ts                # 所有 table 定義 (= SQLAlchemy models)
│   ├── migrations/              # drizzle-kit 產生的 SQL
│   ├── migrate.ts               # 跑 migration 的 entry point
│   └── seed.ts                  # seed 資料
├── features/scheduler/          # 領域模組 (前端 + 型別)
│   ├── types.ts                 # Zod schema (= Pydantic models)
│   ├── hooks/                   # React Query hooks (前端資料層)
│   ├── lib/                     # API client + format helper
│   └── components/              # React UI
├── lib/                         # 跨領域共用程式碼
│   ├── inventory-client.*.ts    # 外部 inventory 系統 client (含 mock)
│   ├── inventory-types.ts       # 共用 Zod schema
│   ├── projectors.ts            # DB row → API DTO 的轉換
│   └── sync.ts                  # 同步任務邏輯
└── instrumentation.ts           # Next.js 啟動 hook (= FastAPI startup)
```

**約定**：任何新檔案都放進 `src/` 下對應子目錄，**不要**放到專案根目錄。

---

## 3. 環境準備

### 必要工具
- **Node.js ≥ 20**（`.nvmrc` 若有就用 nvm；沒有就裝 LTS）
- **PostgreSQL 14+**（local 用 docker 跑就好）
- **npm**（已隨 Node 安裝）

### 第一次 setup

```bash
# 1. 裝依賴 (= pip install -r requirements.txt)
npm install

# 2. 設定環境變數
cp .env.example .env.local   # 若沒有 example，手動建 .env.local
# 填入：
#   DATABASE_URL=postgres://user:pass@localhost:5432/schedview
#   NEXT_PUBLIC_SCHEDULER_API=/api          (本機可省略)

# 3. 跑 migration (= alembic upgrade head)
npm run db:migrate

# 4. 灌種子資料
npm run db:seed

# 5. 啟動 dev server (= uvicorn --reload)
npm run dev
# → http://localhost:3000
```

### 常用指令

| 指令 | 對應動作 |
|---|---|
| `npm run dev` | 啟動 dev server（hot reload） |
| `npm run build` | production build |
| `npm run start` | 跑 production build |
| `npm run typecheck` | `tsc --noEmit`（= mypy） |
| `npm run lint` | ESLint |
| `npm test` | Vitest 跑單元測試 |
| `npm run db:generate` | 從 `schema.ts` 產生新 migration（= `alembic revision --autogenerate`） |
| `npm run db:migrate` | 套用 migration（= `alembic upgrade head`） |
| `npm run db:studio` | 開啟 GUI 看資料（瀏覽器） |
| `npm run db:seed` | 灌 seed 資料 |

---

## 4. 寫一個 API endpoint（= FastAPI route）

### FastAPI 寫法
```python
@router.get("/schedule-requests")
async def list_requests(db: Session = Depends(get_db)):
    rows = db.query(ScheduleRequest).filter(ScheduleRequest.deleted_at.is_(None)).all()
    return [ScheduleRequestDTO.from_orm(r) for r in rows]
```

### Next.js 寫法（`src/app/api/schedule-requests/route.ts`）
```ts
import { desc, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { scheduleRequest } from '@/db/schema';

export const runtime = 'nodejs';   // 強制走 Node runtime（要存取 pg）

export async function GET() {
  const rows = await db
    .select()
    .from(scheduleRequest)
    .where(isNull(scheduleRequest.deletedAt))
    .orderBy(desc(scheduleRequest.submittedAt));
  return NextResponse.json(rows);
}
```

**對照規則**：
- 檔名 `route.ts`，**資料夾路徑 = URL 路徑**
- HTTP method 寫成同名 `export async function`：`GET` / `POST` / `PUT` / `DELETE` / `PATCH`
- 動態參數用 `[id]` 命名資料夾（= FastAPI 的 `{id}`），透過第二個參數拿到：
  ```ts
  export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // ...
  }
  ```
- 回傳一律用 `NextResponse.json(...)`

---

## 5. 資料庫：Drizzle ≈ SQLAlchemy

### 定義 table（`src/db/schema.ts`）

```ts
export const scheduleRequest = pgTable('schedule_request', {
  id: text('id').primaryKey(),
  clusterId: text('cluster_id').notNull(),
  submittedAt: bigint('submitted_at', { mode: 'number' }).notNull(),
  status: text('status').notNull(),
  deletedAt: bigint('deleted_at', { mode: 'number' }),    // nullable
}, (t) => [
  index('idx_sr_cluster').on(t.clusterId),
]);
```

對照 SQLAlchemy：
```python
class ScheduleRequest(Base):
    __tablename__ = 'schedule_request'
    id = Column(Text, primary_key=True)
    cluster_id = Column(Text, nullable=False)
    submitted_at = Column(BigInteger, nullable=False)
    status = Column(Text, nullable=False)
    deleted_at = Column(BigInteger, nullable=True)
    __table_args__ = (Index('idx_sr_cluster', 'cluster_id'),)
```

### Query

```ts
import { eq, and, desc, isNull } from 'drizzle-orm';

// SELECT * FROM schedule_request WHERE id = ? AND deleted_at IS NULL
const [row] = await db
  .select()
  .from(scheduleRequest)
  .where(and(eq(scheduleRequest.id, id), isNull(scheduleRequest.deletedAt)));

// INSERT
await db.insert(scheduleRequest).values({ id, clusterId, submittedAt, status: 'pending' });

// UPDATE
await db.update(scheduleRequest).set({ status: 'done' }).where(eq(scheduleRequest.id, id));

// Transaction
await db.transaction(async (tx) => {
  await tx.insert(scheduleRequest).values({ ... });
  await tx.insert(schedulePlacement).values([...]);
});
```

### 改 schema 流程
1. 改 `src/db/schema.ts`
2. `npm run db:generate` → 在 `src/db/migrations/` 產出新 SQL
3. **看一眼 SQL**（自動產的東西不一定對，特別是 rename）
4. `npm run db:migrate` 套用
5. 把 schema 改動 + migration 一起 commit

---

## 6. Schema validation：Zod ≈ Pydantic

### Pydantic
```python
class Capacity(BaseModel):
    cpu_cores: int = Field(ge=0)
    memory_mb: int = Field(ge=0)

class Baremetal(BaseModel):
    id: str
    total_capacity: Capacity
    ip_types: list[Literal['public', 'private']]
```

### Zod（`src/features/scheduler/types.ts`）
```ts
export const CapacitySchema = z.object({
  cpu_cores: z.number().int().nonnegative(),
  memory_mb: z.number().int().nonnegative(),
});
export type Capacity = z.infer<typeof CapacitySchema>;   // ← 自動推型別

export const BaremetalSchema = z.object({
  id: z.string(),
  total_capacity: CapacitySchema,
  ip_types: z.array(z.enum(['public', 'private'])),
});
export type Baremetal = z.infer<typeof BaremetalSchema>;
```

**用法**：
```ts
const data = BaremetalSchema.parse(rawJson);        // throw on invalid
const result = BaremetalSchema.safeParse(rawJson);  // 回 { success, data | error }
```

**重要原則**：API 回傳的 JSON 在前端 client 一律過 `Schema.parse()` 一次（見 `src/features/scheduler/lib/api.ts`），確保 runtime 真的符合型別。Zod schema 是前後端共用的 single source of truth，**改 API contract 時先改 schema**。

---

## 7. 前端資料抓取：TanStack Query

Python 沒有對等概念，但概念很直白：**它是 server state 的 cache + revalidator**。

```tsx
// src/features/scheduler/hooks/useScheduleRequests.ts
export function useScheduleRequests(filters) {
  const query = useQuery({
    queryKey: ['schedule-requests'],     // cache key
    queryFn: listScheduleRequests,        // 怎麼抓
    refetchInterval: 5_000,               // 每 5 秒自動 refresh
    staleTime: 2_000,                     // 2 秒內視為新鮮
  });
  // ...
  return { ...query, requests: filtered };
}
```

Component 端只要：
```tsx
const { requests, isLoading, error } = useScheduleRequests({ search, status });
```

不用自己寫 `useEffect` + `useState` + loading flag。Cache 是全域的（在 `src/app/providers.tsx` 設定）。

---

## 8. 從零加一個功能（流程範例）

需求：新增 `GET /api/baremetals?site=xxx` 列出指定 site 的 baremetal。

1. **schema 已存在** → 跳過。否則改 `src/db/schema.ts` + 跑 `db:generate` + `db:migrate`。
2. **加 Zod schema**（若還沒有）：在 `src/features/scheduler/types.ts` 或 `src/lib/inventory-types.ts`。
3. **加 API route**：建立 `src/app/api/baremetals/route.ts`
   ```ts
   export async function GET(req: Request) {
     const site = new URL(req.url).searchParams.get('site');
     const rows = await db.select().from(baremetal)
       .where(site ? eq(baremetal.site, site) : undefined);
     return NextResponse.json(rows);
   }
   ```
4. **加 client function**：在 `src/features/scheduler/lib/api.ts` 加 `listBaremetals(site)`，記得用 zod parse。
5. **加 hook**：`src/features/scheduler/hooks/useBaremetals.ts`，包成 `useQuery`。
6. **在 component 用**：`const { data } = useBaremetals(site);`
7. **寫測試**：在對應目錄放 `*.test.ts`，跑 `npm test`。
8. **commit**：每完成一段就 commit。

---

## 9. 測試

```bash
npm test                # 一次跑完
npm test -- --watch     # watch 模式
npm test -- path/to/file.test.ts
```

Vitest API 幾乎就是 Jest / pytest 的混合體：
```ts
import { describe, it, expect } from 'vitest';

describe('projectScheduleRequest', () => {
  it('maps db row to dto', () => {
    expect(projectScheduleRequest(row, 3)).toMatchObject({ id: 'sr-1', placement_count: 3 });
  });
});
```

---

## 10. 常見 Python 思維陷阱

| Python 直覺 | TS / JS 真相 |
|---|---|
| `None` | `null` 跟 `undefined` 是兩個東西。DB 拿出的空值多半是 `null`，沒設定的物件欄位是 `undefined` |
| `dict[str, Any]` | TS 不歡迎 `any`。用 Zod 或 interface 把型別寫出來 |
| `==` 是值相等 | JS 的 `==` 會做隱式轉型，**永遠用 `===`** |
| `for r in rows: ...` | 可用 `for (const r of rows)`，但更常見是 `rows.map(r => ...)` 或 `rows.filter(...)` |
| `async/await` 一樣的 | 是一樣，但**所有 promise 沒 await 都是火警**。ESLint 會抓 |
| import 是相對路徑 | 用 `@/` 開頭表示從 `src/`：`import { db } from '@/db/client'` |
| 例外處理 | 慣例是回 `NextResponse.json({ error: { message } }, { status: 4xx })`，前端 client 看 `res.ok` 判斷 |

---

## 11. 開發守則（摘自 CLAUDE.md）

- **先搜尋再寫**：要新功能前先 grep 看有沒有現成的，能擴充就擴充，不要做 `xxx_v2.ts`。
- **Single source of truth**：型別定義、API contract、format helper 都只能有一份。
- **每完成一個 task 就 commit**，並 push 到 GitHub。
- **檔案不要放專案根目錄**，永遠進 `src/` 對應子目錄。
- **不要憑空寫文件**（`.md`）除非有人要求。

---

## 12. 還沒決定要不要學 TS？

可以的。建議路徑：
1. 先把這份 guide 跟著走一遍，建一個 endpoint。
2. 真正卡住的點通常是：**型別系統**（type narrowing、generics）跟 **async / promise 行為**。卡到再回頭翻文件。
3. 編輯器裝 VS Code + 內建的 TS 支援，hover 看型別比讀 docs 快。
4. Solver / 重運算的部分維持 Python，透過 HTTP 接到 Next.js，這樣兩邊都做擅長的事。
