# Schedule Requests Dashboard — Production handoff

Drop-in TSX + Tailwind translation of the `DashboardB` prototype. Everything here is plain
TypeScript React; no prototype-specific globals (`window.MOCK_DATA`, inline styles, etc).

## Structure

```
codegen/
├── README.md                           ← you are here
├── types.ts                            ← domain types + Zod schemas
├── lib/
│   ├── format.ts                       ← fmtTime / ago / bytes / pct helpers
│   └── api.ts                          ← fetch wrappers (stubs — replace with your client)
├── hooks/
│   ├── useScheduleRequests.ts          ← list + filter
│   └── useScheduleRequestDetail.ts     ← detail + placement + baremetals
├── components/
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Pill.tsx
│   │   ├── StatusDot.tsx
│   │   ├── KpiTile.tsx
│   │   ├── SectionHeader.tsx
│   │   └── ResourceBar.tsx             ← stacked used + new-delta bar
│   └── schedule-request/
│       ├── RequestListPanel.tsx        ← left column: search + filter + list
│       ├── RequestHeader.tsx           ← title, status, meta
│       ├── RequestKpiRow.tsx           ← 4-up KPI tiles
│       ├── PlacementMap.tsx            ← per-AG → BM grouping
│       ├── BaremetalCard.tsx           ← one BM with CPU/MEM/DISK bars + VM pills
│       ├── ConstraintsPanel.tsx
│       └── ScheduleRequestDashboard.tsx ← root page
└── app/(example)/schedule-requests/page.tsx  ← example App Router wiring
```

## Requirements

- **React 18+ / Next.js 14+ (App Router)** — anything with TSX works, Next is only used in the example page
- **Tailwind CSS v3+** — config snippets in `tailwind.config.snippet.ts`
- **@tanstack/react-query v5** — for data fetching
- **zod** — runtime validation of API responses

Install:
```bash
pnpm add @tanstack/react-query zod
```

## Tailwind config

Merge into your `tailwind.config.ts`:

```ts
// see tailwind.config.snippet.ts
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
    },
    colors: {
      // slate is default; only custom tokens below
      canvas: 'rgb(var(--canvas) / <alpha-value>)',
      surface: 'rgb(var(--surface) / <alpha-value>)',
    },
    boxShadow: {
      card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
    },
  },
},
```

Add to `globals.css`:
```css
:root {
  --canvas: 248 250 252;   /* slate-50 */
  --surface: 255 255 255;
}
.dark {
  --canvas: 15 23 42;      /* slate-900 */
  --surface: 30 41 59;     /* slate-800 */
}
```

## API contract

See `types.ts` for the full Zod schemas. Minimum endpoints:

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/schedule-requests` | `ScheduleRequest[]` |
| `GET` | `/api/schedule-requests/:id` | `ScheduleRequest` |
| `GET` | `/api/schedule-requests/:id/placement` | `PlacementResult` (includes BM + delta per host) |

`PlacementResult` is the important one — it should be pre-joined on the server so the
dashboard doesn't have to fan out N+1 queries for BM detail.

## Wiring checklist

1. Copy `codegen/` into your repo (rename folder to something sensible, e.g. `src/features/scheduler/`).
2. Replace the stubs in `lib/api.ts` with your real HTTP client.
3. Mount `<ScheduleRequestDashboard />` somewhere — see the example page.
4. Verify the Zod schemas against a real API response; tune fields.
5. Tweak Tailwind colors to match your design system.
