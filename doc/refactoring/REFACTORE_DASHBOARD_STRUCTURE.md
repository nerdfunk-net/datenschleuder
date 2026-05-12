# Dashboard Structure Refactoring Plan

## Problem

Route files under `app/(dashboard)/` must be **pure stubs** — they exist only to wire a URL to a feature component.
Currently several route files contain inline logic, JSX, state, and even full component trees.
Additionally, some route directories contain `components/` and `dialogs/` subdirectories that belong in `components/features/`.

The **correct pattern** (already used in well-structured pages):
```tsx
// app/(dashboard)/agents/deploy-nifi/page.tsx  ← CORRECT
import { DeployNifiWizard } from '@/components/features/agents/deploy-nifi'

export default function DeployNifiPage() {
  return <DeployNifiWizard />
}
```

The stub may optionally export Next.js `metadata`:
```tsx
import type { Metadata } from 'next'
import { MyPage } from '@/components/features/domain/my-page'

export const metadata: Metadata = { title: '...' }

export default function MyRoute() {
  return <MyPage />
}
```

**Never add `'use client'` to route files.** The directive belongs on the feature component itself.

---

## What CLAUDE.md Currently Says

`CLAUDE.md` lists the frontend structure as:
```
/app/(dashboard)/{feature}/page.tsx  # Route pages
```
but gives no explicit rule about stub-only content.

**Required addition to `CLAUDE.md`:** Add a rule under "Frontend Structure" stating that `page.tsx` files are stubs only — no logic, no JSX beyond `<FeaturePage />`, no `'use client'`.

---

## Violations Found

### Category A — Full inline logic in route file (no feature component exists)

| Route file | Lines | What needs to happen |
|---|---|---|
| `tools/certificates/page.tsx` | 486 | Extract to `components/features/tools/certificates/certificates-page.tsx` |
| `tools/ping/page.tsx` | 397 | Extract to `components/features/tools/ping/ping-page.tsx` |
| `tools/oidc-test/page.tsx` | 157 | Extract to `components/features/tools/oidc/oidc-test-page.tsx` |
| `tools/database-migration/page.tsx` | 154 | Extract to `components/features/tools/database-migration/database-migration-page.tsx` |
| `tools/page.tsx` | 130 | Extract to `components/features/tools/hub/tools-hub-page.tsx` |
| `settings/page.tsx` | 93 | Extract to `components/features/settings/hub/settings-hub-page.tsx` |
| `settings/templates/editor/page.tsx` | 58 | Extract to `components/features/settings/templates/editor/template-editor-page.tsx` |

### Category B — Components and dialogs nested under route directories (wrong location)

These files are **feature components** but live inside `app/(dashboard)/` instead of `components/features/`.

| Current path | Target path |
|---|---|
| `tools/database-migration/components/migration-result-report.tsx` | `components/features/tools/database-migration/components/migration-result-report.tsx` |
| `tools/database-migration/components/migration-system-info.tsx` | `components/features/tools/database-migration/components/migration-system-info.tsx` |
| `tools/database-migration/components/rbac-seeding-section.tsx` | `components/features/tools/database-migration/components/rbac-seeding-section.tsx` |
| `tools/database-migration/components/schema-diff-view.tsx` | `components/features/tools/database-migration/components/schema-diff-view.tsx` |
| `tools/database-migration/dialogs/seed-output-modal.tsx` | `components/features/tools/database-migration/dialogs/seed-output-modal.tsx` |
| `tools/database-migration/dialogs/seed-rbac-dialog.tsx` | `components/features/tools/database-migration/dialogs/seed-rbac-dialog.tsx` |
| `tools/oidc-test/components/configuration-details.tsx` | `components/features/tools/oidc/components/configuration-details.tsx` |
| `tools/oidc-test/components/debug-logs-section.tsx` | `components/features/tools/oidc/components/debug-logs-section.tsx` |
| `tools/oidc-test/components/global-config-section.tsx` | `components/features/tools/oidc/components/global-config-section.tsx` |
| `tools/oidc-test/components/provider-list.tsx` | `components/features/tools/oidc/components/provider-list.tsx` |
| `tools/oidc-test/components/status-overview.tsx` | `components/features/tools/oidc/components/status-overview.tsx` |
| `tools/oidc-test/utils/oidc-icon-helpers.tsx` | `components/features/tools/oidc/utils/oidc-icon-helpers.tsx` |

### Category C — Route files with incorrect `'use client'` directive

These files are already stubs (correct imports) but carry `'use client'` at the route level, which prevents the route from being a Server Component.

| Route file | Fix |
|---|---|
| `jobs/scheduler/page.tsx` | Remove `'use client'`; ensure feature component has the directive |
| `jobs/templates/page.tsx` | Remove `'use client'`; ensure feature component has the directive |
| `jobs/view/page.tsx` | Remove `'use client'`; ensure feature component has the directive |
| `settings/permissions/page.tsx` | Remove `'use client'`; ensure feature component has the directive |

---

## Migration Steps Per Category

### Category A — Extract inline logic

For each route file listed above:

1. Create the new feature directory under `components/features/`.
2. Move the component body (all JSX, state, hooks, constants) into a new `{feature}-page.tsx` file.
3. Export the component with a named export from that file.
4. If the route directory contains `components/` or `dialogs/` subdirectories, move those too (see Category B steps — do this at the same time).
5. Replace the route file contents with a minimal stub:
   ```tsx
   import { MyFeaturePage } from '@/components/features/domain/feature/my-feature-page'

   export default function MyFeatureRoute() {
     return <MyFeaturePage />
   }
   ```
6. Update all internal imports inside the moved component to use the new relative paths.
7. Run `npm run build` (or `tsc --noEmit`) to verify no broken imports.

### Category B — Move misplaced components

For `tools/database-migration` and `tools/oidc-test`:

1. Do this **together with Category A** for the same feature — one commit per feature.
2. Create target directory under `components/features/tools/{feature}/`.
3. Move `components/`, `dialogs/`, `utils/` subdirectories there.
4. Update all import paths in the moved files and in the new page component.
5. Delete the now-empty subdirectories from the route directory.

### Category C — Remove `'use client'` from route files

1. Verify the imported feature component already has `'use client'` at its top.
2. If not, add `'use client'` to the feature component.
3. Remove `'use client'` from the route file.
4. Run build/type check to confirm nothing broke.

---

## Recommended Execution Order

Work feature-by-feature, one PR per domain:

| PR | Scope |
|---|---|
| 1 | `tools/certificates` — Category A |
| 2 | `tools/ping` — Category A |
| 3 | `tools/oidc-test` — Category A + B (move components + page extraction together) |
| 4 | `tools/database-migration` — Category A + B (move components + page extraction together) |
| 5 | `tools/page.tsx` (tools hub) — Category A |
| 6 | `settings/page.tsx` (settings hub) — Category A |
| 7 | `settings/templates/editor/page.tsx` — Category A |
| 8 | `jobs/*` + `settings/permissions` — Category C (trivial `'use client'` removal) |
| 9 | Update `CLAUDE.md` to document the stub-only rule |

PRs 1–2 are independent and can be done in parallel. PRs 3–4 are independent of each other. PR 9 should be the last step.

---

## CLAUDE.md Additions Required

Add the following block under **Frontend Structure** (after the directory tree):

```markdown
### Route File Rule — Stubs Only

`/app/(dashboard)/*/page.tsx` files MUST be pure route stubs.

**CORRECT:**
```tsx
import { MyFeaturePage } from '@/components/features/domain/my-feature-page'

export default function MyFeatureRoute() {
  return <MyFeaturePage />
}
```

**Rules:**
- ❌ No logic, state, or hooks in route files
- ❌ No `'use client'` directive on route files (add it to the feature component instead)
- ❌ No `components/` or `dialogs/` subdirectories inside route directories
- ✅ Optional: `export const metadata: Metadata = { title: '...' }` is allowed
- ✅ Optional: `export const dynamic = 'force-dynamic'` and similar Next.js segment config is allowed
- ✅ All feature logic lives in `components/features/{domain}/`
```

---

## Files That Are Already Correct (Reference)

These pages follow the stub pattern correctly and serve as examples:

- `agents/deploy-nifi/page.tsx` — 5 lines
- `agents/operating/page.tsx` — 5 lines
- `flows/deploy/page.tsx` — 11 lines (with metadata)
- `flows/manage/page.tsx` — 11 lines (with metadata)
- `nifi/cert-manager/page.tsx` — 11 lines (with metadata)
- `settings/celery/page.tsx` — 5 lines
- `settings/git/page.tsx` — 11 lines (with metadata)
- `settings/nifi/cluster-wizard/page.tsx` — 11 lines (with metadata)
- `tools/pki/page.tsx` — 10 lines (with metadata)
- `profile/page.tsx` — 4 lines
