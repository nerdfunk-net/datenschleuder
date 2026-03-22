# Frontend Refactoring Plan

## Executive Summary

**Overall Score: 92/100**

- 435 TS/TSX files across the frontend codebase
- 100 files exceed 200 lines
- 20 files exceed 500 lines
- Two categories of issues: **monolithic files** and **anti-patterns**

The codebase is largely well-structured with good adoption of TanStack Query, feature-based organization, and Shadcn UI. The issues below are targeted — fixing them brings the codebase to full alignment with the architectural standards in CLAUDE.md.

---

## Anti-Patterns — Highest Priority (Fix First)

### 1. Manual `useState + useEffect` for Server Data (TanStack Query Violations)

**STATUS: ✅ COMPLETE (2026-03-21)**

#### `features/profile/profile-page.tsx` ✅

- Removed 74-line manual `useEffect` fetch + all server `useState`
- Created `features/profile/hooks/queries/use-profile-query.ts`
- Created `features/profile/hooks/queries/use-profile-mutations.ts`
- `handleSave` is now synchronous — mutation handles async, toast, and cache update
- Added `profile` + `systemCertificates` keys to `query-keys.ts`

#### `app/(dashboard)/tools/certificates/page.tsx` ✅

- Removed `scanCertificates` useCallback + `useEffect([scanCertificates])`
- Removed `certificates`, `certsDirectory`, `loading`, `scanning` from `useState`
- Created `app/(dashboard)/tools/certificates/hooks/use-certificates-query.ts`
- All post-action refreshes now use `refetch()` from the query hook

---

### 2. Inconsistent Hook Patterns

- Some hooks correctly use `DEFAULT_OPTIONS = {}` + options object (e.g., `useCredentialsQuery`)
- Most hooks use direct positional parameters — inconsistent with the standard
- Some mutation hooks do not memoize their return objects with `useMemo`, creating re-render risk

See [Hook Standardization](#hook-standardization) for the required pattern.

---

## Monolithic Files — Component Extraction

### `features/profile/profile-page.tsx` — 859 lines → **✅ COMPLETE**

Full feature structure extracted. Orchestrator is now ~200 lines.

```
features/profile/
├── profile-page.tsx                    ✅ orchestrator (~200 lines)
├── components/
│   ├── personal-info-section.tsx       ✅
│   ├── api-key-section.tsx             ✅ (also exports TokensCard wrapper)
│   ├── credential-form.tsx             ✅
│   └── password-section.tsx           ✅
├── hooks/queries/
│   ├── use-profile-query.ts            ✅
│   ├── use-profile-mutations.ts        ✅
│   └── (use-credential-management.ts not needed — handlers are simple enough to stay in page)
├── types/
│   └── profile-types.ts               ✅
└── utils/
    ├── profile-validators.ts           ✅ (validateApiKey, generateApiKey)
    └── credential-transform.ts        ✅ (generateCredentialId, mapServerCredential, buildCredentialPayload)
```

---

### `features/flows/manage/flows-manage-page.tsx` — 885 lines → **✅ COMPLETE (2026-03-21)**

TanStack Query is already used correctly here. Extract UI concerns only.

```
features/flows/manage/
├── flows-manage-page.tsx               ✅ orchestrator (~360 lines)
├── components/
│   ├── flow-table-toolbar.tsx          ✅ (column/view dropdowns + action buttons)
│   ├── flow-filters-section.tsx        ✅ (per-column filter inputs)
│   └── flow-table.tsx                  ✅ (table + pagination + FlowTableRow)
└── hooks/
    ├── use-flow-filtering.ts           ✅ (filter state, pagination, filteredFlows memoization)
    ├── use-flow-table-columns.ts       ✅ (column visibility, initialization, default view)
    └── use-flow-view-management.ts    ✅ (save/load/delete views, saveViewOpen state)
```

---

### `features/nifi/monitoring/tabs/flows-tab.tsx` — 810 lines → **✅ COMPLETE (2026-03-21)**

```
features/nifi/monitoring/
├── tabs/flows-tab.tsx                  ✅ orchestrator (~220 lines)
├── components/
│   ├── flow-widget.tsx                 ✅
│   ├── flow-monitoring-toolbar.tsx     ✅
│   ├── flow-summary-cards.tsx          ✅
│   └── flow-grid.tsx                   ✅
├── hooks/
│   ├── use-flow-status-check.ts        ✅ (checkAllFlows + flowStatuses + counts)
│   └── use-flow-monitoring-filters.ts  ✅ (search/status/cluster filter state)
└── utils/
    ├── flow-status-utils.ts            ✅
    └── flow-widget-styles.ts          (merged into flow-widget.tsx)
```

---

### `app/(dashboard)/tools/oidc-test/page.tsx` — 720 lines → **✅ COMPLETE (2026-03-21)**

Also migrated `fetchDebugInfo` from manual `useState + useEffect` to TanStack Query.

```
app/(dashboard)/tools/oidc-test/
├── page.tsx                            ✅ orchestrator (~157 lines)
├── components/
│   ├── status-overview.tsx             ✅
│   ├── provider-list.tsx               ✅
│   ├── configuration-details.tsx       ✅ (tabs for config/endpoints/test)
│   ├── global-config-section.tsx       ✅
│   └── debug-logs-section.tsx         ✅
├── hooks/
│   ├── use-oidc-debug-info.ts          ✅ (TanStack Query)
│   ├── use-oidc-test-parameters.ts     ✅
│   └── use-debug-logging.ts           ✅
├── types/
│   └── oidc-types.ts                  ✅
└── utils/
    └── oidc-icon-helpers.tsx           ✅
```

---

### `app/(dashboard)/tools/database-migration/page.tsx` — 582 lines → **✅ COMPLETE (2026-03-21)**

Also migrated `fetchStatus` from manual `useState + useEffect` to TanStack Query.

```
app/(dashboard)/tools/database-migration/
├── page.tsx                            ✅ orchestrator (~110 lines)
├── components/
│   ├── migration-system-info.tsx       ✅ (system info card + history table)
│   ├── schema-diff-view.tsx            ✅ (missing tables/columns + migrate button)
│   ├── migration-result-report.tsx     ✅ (post-migration result display)
│   └── rbac-seeding-section.tsx        ✅ (RBAC seeding card)
├── dialogs/
│   ├── seed-rbac-dialog.tsx            ✅ (confirmation dialog)
│   └── seed-output-modal.tsx           ✅ (seed output modal)
├── hooks/
│   ├── use-database-migration.ts       ✅ (TanStack Query for status + migrations, mutation for migrate)
│   └── use-rbac-seeding.ts             ✅ (useMutation + dialog state)
└── types/
    └── database-migration-types.ts     ✅ (all interfaces)
```

---

### `features/nifi/install/nifi-install-page.tsx` — 515 lines → **✅ COMPLETE (2026-03-21)**

```
features/nifi/install/
├── nifi-install-page.tsx               ✅ orchestrator (~124 lines)
├── types.ts                            ✅
├── hooks/                              ✅
│   ├── use-install-query.ts
│   └── use-install-mutations.ts
└── components/                         ✅
    ├── path-section.tsx                ✅
    └── section-wrapper.tsx             ✅
```

---

## Minor Structural Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Inner dir naming | `settings/permissions/permissions/` | ✅ DONE — renamed to `managers/` |
| Schemas dir | `jobs/templates/schemas/` | Move to `utils/` or `types/` |
| Missing `components/` dir | `nifi/install/` | ✅ DONE — created in P3 |
| Missing components/types/utils | `profile/` | ✅ DONE — full structure created |
| Missing `hooks/` dir | `certificates/` | ✅ DONE — created in P1 |

---

## Hook Standardization

All query hooks should follow the pattern from `use-credentials-query.ts`:

```typescript
interface UseXxxQueryOptions {
  filters?: { status?: string }
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseXxxQueryOptions = {}

export function useXxxQuery(options: UseXxxQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.xxx.list(filters),
    queryFn: async () => apiCall('xxx', { method: 'GET' }),
    enabled,
    staleTime: 30 * 1000,
  })
}
```

All mutation hooks must memoize their return value:

```typescript
export function useXxxMutations() {
  const create = useMutation({ ... })
  const update = useMutation({ ... })
  const remove = useMutation({ ... })

  return useMemo(
    () => ({ create, update, remove }),
    [create, update, remove]
  )
}
```

---

## Priority Order

### P1 — Anti-patterns (correctness issues) ✅ COMPLETE

1. ~~Migrate `profile-page.tsx` server state to TanStack Query~~ ✅
2. ~~Migrate `certificates/page.tsx` server state to TanStack Query~~ ✅

### P2 — Large monoliths with mixed concerns (maintainability)

3. ~~`flows-tab.tsx` — extract pure functions + FlowWidget~~ ✅ (toolbar/hooks/grid extraction still pending → moved to P3)
4. ~~`profile-page.tsx` — create full feature structure~~ ✅
5. ~~`flows-manage-page.tsx` — extract components and hooks~~ ✅
6. ~~`database-migration/page.tsx` — separate migration/RBAC concerns~~ ✅

### P3 — Structural cleanup (consistency) ✅ COMPLETE (2026-03-22)

7. ~~`nifi/install/` — add `components/` directory~~ ✅
8. ~~`oidc-test/page.tsx` — extract components~~ ✅ (+ TanStack Query migration bonus)
9. ~~Rename `permissions/permissions/` → `permissions/managers/`~~ ✅
10. ~~Standardize all hook signatures (options object + `DEFAULT_OPTIONS`) — remaining: query hooks in settings/~~ ✅
11. ~~Add `useMemo` to mutation hook returns that are missing it~~ ✅ (fixed 7 hooks)
