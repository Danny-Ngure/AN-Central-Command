# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"AN Central Command" — a campaign intelligence web portal for the Alfayo Nelson Nyali Constituency campaign (Mombasa, Kenya). It is a **frontend-only React SPA with no backend**: all data lives in `src/data/mockData.ts` and all state is held in React context. Database, RLS (row-level security), and audit logging are **simulated in-memory** to mirror a future backend's contract.

Formal specs live alongside the code as PDFs in the repo root: `SRS-ALFAYO-001.pdf` (requirements) and `ARC-ALFAYO-001.pdf` (architecture). When a comment references something like `BR-130.1` or `DPA §26`, the cross-reference is in those documents.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # tsc type-check THEN vite build — both must pass
npm run lint      # eslint, 0 warnings allowed (--max-warnings 0)
npm run preview   # serve the production build
```

There is no test framework configured.

## Architecture

### Single-suite-with-modes shell, no router

`src/App.tsx` is the shell. There is no router — screen switching is plain `useState` (`activeTab`). The app is split into two **suites** selected by `activeSystem` in context:

- **Command Suite** (`activeSystem === 'command'`): Dashboard, Analytics, NyaliTrack, Team, AuditLogs
- **Data Entry** (`activeSystem === 'data_entry'`): Supporters, Issues, Community

Switching suites also resets the default role (manager vs canvasser). The `useEffect` in `App.tsx` snaps `activeTab` back to the suite's default if it falls out of the allowed set — keep that map in sync if you add or rename a tab.

### `CampaignContext` is the whole application state

`src/context/CampaignContext.tsx` is the single source of truth. It owns:

- All entity lists (`leaders`, `sites`, `supporters`, `issues`, `pollingStations`, `incidents`, `activities`, `auditLogs`, `notifications`)
- Config (`language` en/sw, `activeRole`, `activeSystem`) and `t(key)` translator
- All mutations — every list is mutated **only** through context actions (`addIssue`, `addLeader`, `submitIncident`, `withdrawSupporterConsent`, …). Components never `setState` on the lists directly.
- Side effects of mutations: each one calls `addAudit(…)` to append to the audit log, and critical events push a `notification`. Preserve this pattern when adding new actions — the audit log is **append-only** and is the simulation's compliance contract.

### Simulated Row-Level Security

Lists exposed by the context are **filtered by the active role** via `filterByRLS` and the per-entity `getFiltered*` helpers. Rules to know about:

- `coordinator`, `canvasser`, `agent` are ward-scoped (by `wardId` / `wardScope`). Leadership roles (`candidate`, `manager`, `strategist`) see everything.
- `agent` sees only their assigned polling station (hard-coded `ps-fre-2`) and gets an empty `supporters` list.
- `canvasser` sees only supporters they themselves registered (`registeringPersonId`).
- `canvasser`-submitted leaders enter with `isQueuedForReview: true` and require `approveLeader` to activate. The Community/Sidebar badge counts queued leaders — don't bypass the queue for canvassers.

When adding a new entity type, decide its RLS rule explicitly and route reads through a `getFiltered*` helper rather than exposing raw state.

### Data-protection rules baked into actions

- `addCommittedSupporter` **rejects** any record missing `consentMethod` (BR-130.1) and returns `{ success: false, error }`. Callers must surface the error.
- `withdrawSupporterConsent(id, hardDelete)` distinguishes soft-withdraw from hard erase. Hard erase nulls PII (`fullName`, `nationalIdMasked`, `notes`) but keeps the row for metric counts (DPA §26). Do not introduce a path that fully deletes the row.

### i18n

Translations live inline in `CampaignContext.tsx` as a `TRANSLATIONS: Record<'en' | 'sw', Record<string, string>>` dictionary. Use `t('namespace.key')` everywhere user-facing — never hard-code English strings. New keys must be added to **both** language blocks; `t` falls back to returning the key if missing, which makes omissions visible in the UI.

### Map

`src/components/InteractiveMap.tsx` uses Mapbox GL JS with an automatic SVG fallback when WebGL is unsupported or Mapbox fails to load (`useSvgFallback`). The Mapbox `accessToken` is a public demo token committed in source; both render paths must continue to work if you touch the map.

### Styling

Tailwind with `darkMode: 'class'` (the root `<html>` is permanently `class="dark"`). The custom palette lives under `theme.extend.colors.brand.*` in `tailwind.config.js` — prefer `brand-violet`, `brand-cyan`, `brand-textMuted`, etc. over raw hex values. `glass-panel` / `glass-panel-heavy` utilities in `src/index.css` are the standard surface treatment.

## Conventions to preserve

- **Never mutate context lists from a component** — add an action on the context instead, and have it call `addAudit` for any state-changing event.
- **Every user-facing string goes through `t(…)`** and gets both `en` and `sw` entries.
- **Reads go through the RLS-filtered context fields** (`leaders`, `supporters`, …), not raw mock arrays or unfiltered state.
- The Sidebar derives notification badges (queued leaders, active issues) from already-filtered context lists; new badges should follow the same pattern rather than re-querying mock data.
