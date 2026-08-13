# SevenCRM Frontend Functional Audit

**Audit type:** Read-only. No files were modified, no packages installed, no backend/database/auth changes made.
**Date:** 2026-08-12
**Method:** Static code inspection (Grep/Read across `src/`) + live runtime verification against the running frontend (`localhost:3000`) and backend (`localhost:3001`), authenticated as the real bootstrap Super Admin (`manojkanthariya@gmail.com`).
**Scope caveat:** Only one real user account exists in the database (the Super Admin). No ADMIN or SALES_EXECUTIVE accounts exist, so role-specific *frontend* behavior for those two roles could not be observed live in this session. Where marked, backend enforcement for those roles is cited from the automated e2e test suite built and run in a prior session (`backend/test/users.e2e-spec.ts`, 10/10 passing against real accounts at that time), not re-verified live here.

---

## Executive Summary

SevenCRM's backend (NestJS + Prisma + Better Auth + the Users API) is real and working. Exactly **one** feature of the frontend — **User Management** — is wired to it end-to-end. Every other feature (Clients, Products, Enquiries, Follow-ups, Quotations, Sales, Reports, Analytics, Settings, and most of the Dashboard) runs entirely on **in-memory or per-render mock data with no backend behind it**. This is expected at this stage of the project and is not, by itself, a defect — but several specific things inside that mock layer are **actually broken** (not just "unbuilt"): forms that show a success toast and persist nothing, a client detail page that shows the same hardcoded company regardless of which client you open, and action menus with no handlers at all. Two Base UI runtime crashes were found and fixed in prior sessions (`dropdown-menu.tsx`, `command.tsx`); this audit found a **third, structurally identical, currently-dormant instance** of the same bug class in `select.tsx` that will crash the instant it's used.

No console errors, network failures, or hydration warnings were observed across a full sweep of ~20 routes. The one reproducible runtime warning is a Recharts sizing warning on the Dashboard (cosmetic, non-blocking).

---

## 1. Critical Issues
*Only things that currently break functionality — i.e., a user takes an action and gets a wrong or nonexistent result. Mock data by itself is not listed here; see Section 15.*

### C1. Client detail page ignores the URL and always shows the same hardcoded client
- **Severity:** Critical
- **Location:** `src/features/clients/client-detail-content.tsx:24-47`
- **Problem:** The component destructures `{ id }` from the route params but never uses it. `client` is a single hardcoded object (`'TechCorp India Pvt Ltd'`) regardless of which client was clicked.
- **Reproduction (verified live):** Navigated to `http://localhost:3000/clients/c1`, then `http://localhost:3000/clients/c2` — both render the identical "TechCorp India Pvt Ltd" record (confirmed via `document.querySelector('h1').textContent` on both).
- **Recommended fix:** Look up the client by `id` from the same source `clients-content.tsx` uses (`@/data/clients`), and render a genuine not-found state for unknown ids.

### C2. "Add Enquiry" form is completely non-functional
- **Severity:** Critical
- **Location:** `src/features/enquiries/enquiry-form.tsx`
- **Problem:** No `<form>` element, no state, no validation, no submit handler. The "Save enquiry" button (line 117) is a plain `<Button>` with no `onClick`. This is self-documented in the file's own comment: *"this is still a visual-only pass; no state, validation, or submit handler is wired up yet (QA-007)."*
- **Reproduction:** Open Enquiries → Add Enquiry → fill fields → click "Save enquiry". Nothing happens: no toast, no dialog close, no new card.
- **Recommended fix:** Wire with `react-hook-form` following the same pattern as `client-form.tsx` / `user-form.tsx`, and connect its result into `enquiries-content.tsx`'s `setEnquiries`.

### C3. Product create/edit form shows a fake success toast with zero persistence
- **Severity:** Critical
- **Location:** `src/features/products/product-form.tsx:84-87`, `src/features/products/products-content.tsx:24-39,260-264`
- **Problem:** `ProductForm.onSubmit` only calls `toast.success(...)` and closes the dialog — it never calls back to the parent. `products-content.tsx` doesn't even pass an `onSubmit` prop, and `mockProducts` isn't state at all — it's a `const` recomputed **on every render** using `Math.random()`, so even the list itself reshuffles prices/stock on every re-render, independent of any form action.
- **Reproduction:** Products → Add Product → fill form → Create. Toast says "Product created successfully!" — the table is unchanged (and would show different random prices even without touching the form).
- **Recommended fix:** Move `mockProducts` into `useState` (module-scope, computed once), give `ProductForm` an `onSubmit` prop mirroring `UserForm`'s, and wire it to update that state.

### C4. Client detail page's action buttons have no handlers
- **Severity:** High
- **Location:** `src/features/clients/client-detail-content.tsx:80-103`
- **Problem:** "Edit", "Email", and the dropdown's "Create Enquiry" / "Create Quotation" / "Delete Client" are all plain elements with no `onClick`. Clicking any of them does nothing at all (not even a toast).
- **Recommended fix:** At minimum wire to the existing `ClientForm` (for Edit) and a toast placeholder for the rest, consistent with how `clients-content.tsx` already handles its own action menu.

### C5. Dormant Base UI crash in `SelectLabel` — same bug class as the two already-fixed issues
- **Severity:** High (currently dormant / not yet triggered)
- **Location:** `src/components/ui/select.tsx:98-109`
- **Problem:** `SelectLabel` renders `SelectPrimitive.GroupLabel` directly, without a `SelectPrimitive.Group` ancestor. Confirmed by reading `node_modules/@base-ui/react/select/group-label/SelectGroupLabel.js`: it calls `useSelectGroupRootContext()`, which reads `SelectGroupContext` — structurally identical to the `MenuGroupContext` bug fixed in `dropdown-menu.tsx` two sessions ago. If ever rendered without a wrapping `SelectGroup`, it will throw the same class of `Cannot read properties of undefined` error.
- **Why it hasn't fired yet:** `grep -rn "SelectLabel\|SelectGroup" src` (excluding `select.tsx` itself) returns **zero matches** — no feature currently uses grouped/labeled selects. All current `<Select>` usages (role filters, department filters, status filters, etc.) use plain `<SelectItem>` with no `SelectGroup`/`SelectLabel`.
- **Recommended fix (when picked up, not applied now per read-only instruction):** Same shape as the `dropdown-menu.tsx` fix — wrap `SelectPrimitive.GroupLabel` in `SelectPrimitive.Group` inside `SelectLabel`.

### C6. Quotation Builder's Save/PDF actions are fake — a quotation is never actually saved
- **Severity:** High
- **Location:** `src/features/quotations/quotation-builder.tsx:307,313`
- **Problem:** "Save as draft" → `toast.success('Saved as draft')` only. "Download PDF" → `toast.success('PDF Generation coming soon!')`. Neither writes anywhere. Navigating away from the builder loses the entire quotation, despite the line-item math and GST calculations being genuinely functional up to that point.
- **Recommended fix:** Not a fix to apply now — flagging that the builder's core interaction (build a quotation) currently has no exit path that preserves the user's work.

### C7. Multiple "Actions" dropdown menus across the app render items with no `onClick` at all
- **Severity:** Medium (recurring pattern, not isolated)
- **Locations:**
  - `src/features/quotations/quotations-content.tsx:111-116` — View / Edit / Duplicate / Send Email / Download PDF, all inert.
  - `src/features/enquiries/enquiries-content.tsx:72-80` — stage/priority filter items, all inert (and the "All / My Enquiries / Unassigned / Overdue" sub-filter tabs at lines 93-96 are plain `<button>`s with no `onClick` either).
  - `src/features/clients/client-detail-content.tsx:96-100` — see C4.
- **Recommended fix:** Not applying now; noting as a systemic pattern worth a single pass once the underlying data is real, rather than fixing each menu individually against mock data.

---

## 2. Authentication

| Item | Status | Evidence |
|---|---|---|
| Login | **Working** | Real `POST /api/auth/sign-in/email` via `src/lib/auth-client.ts`; verified live this session (signed in as the real Super Admin). |
| Logout | **Working** | `useAuthStore.logout()` clears local state and calls `POST /api/auth/sign-out`. Not re-clicked live this session, but code path unchanged since last verified working. |
| Session persistence on refresh | **Working** | `(dashboard)/layout.tsx` calls `hydrate()` (→ `GET /api/auth/get-session`) before deciding to redirect. Verified via fetch instrumentation this session: a client-side route change between dashboard pages produces **zero** additional `get-session` calls (the layout doesn't remount), confirming hydration runs once per hard load, not per navigation — this is correct, efficient behavior, not a bug. |
| Unauthorized access | **Enforced server-side** | Verified live this session: `fetch('http://localhost:3001/users', { credentials: 'omit' })` → `401 {"message":"Unauthorized"}`. This is real backend (Better Auth session guard) enforcement, not a frontend-only gate. |
| Inactive user behavior | **Not verified this session** | No inactive/deactivated account currently exists to sign in with. Backend mechanism (see prior session's report) sets Better Auth's `banned` flag on `INACTIVE`, which the `session.create` hook rejects at sign-in. Not re-tested live here. |
| Better Auth integration | **Working** | `trustedOrigins` fix (added in a prior session) confirmed still in place and working — sign-in from `localhost:3000` succeeds without `INVALID_ORIGIN`. |
| Frontend/backend communication | **Working** | `src/lib/api.ts` centralizes all calls with `credentials: "include"`; CORS configured correctly on the backend (`localhost:3000`, `credentials: true`). |
| Error handling | **Implemented, not exhaustively re-tested** | `getFriendlyErrorMessage()` in `src/lib/api.ts` maps 400/401/403/404/409/network to distinct user-facing messages. Verified in a prior session for 409 (duplicate email) and 403 (non-super-admin create attempt); not re-triggered live in this audit. |
| Demo login buttons | **Broken (pre-existing, low severity)** | `src/app/(auth)/login/page.tsx`'s "Quick Demo Access" buttons (Rajesh Kumar, Priya Sharma, Amit Patel, Vikram Singh) reference emails that don't exist in the real database. Clicking one fails gracefully with "Invalid email or password" — not a crash, but the buttons are dead weight and misleading. Not in scope to fix per prior session's instructions; flagging again here since it's still present. |

---

## 3. Authorization

| Item | Status | Evidence |
|---|---|---|
| Backend role enforcement (SUPER_ADMIN/ADMIN/SALES_EXECUTIVE) | **Implemented; verified via automated tests in a prior session, not re-verified live here** | `backend/src/users/users.service.ts` checks `currentUser.crmRole` server-side for every mutation; `backend/test/users.e2e-spec.ts` exercised all three roles with real accounts (since deleted) and passed 10/10. |
| Frontend restrictions are visual-only, backend is authoritative | **Confirmed by design and by code** | `users-content.tsx`'s "Create User" button visibility and `user-table.tsx`'s per-row Edit/Disable gating (`canManage = user.role !== "super-admin"`) are pure UI convenience — the backend independently re-checks role on every request regardless of what the UI shows or hides. Verified live this session: an unauthenticated direct API call is rejected (see Section 2) independent of any frontend state. |
| Route access gating by role | **Not implemented at the route/navigation level** | The sidebar (`src/components/layout/sidebar.tsx`) shows all nav items to every authenticated user regardless of role — there is no role-based filtering of the nav itself. A SALES_EXECUTIVE would see a "Users" link that, if clicked, would load the Users page and then fail with a 403 from the backend (graceful `ErrorState`, per `users-content.tsx`), but the link is not hidden. **Not verified live** (no SALES_EXECUTIVE account exists to click through as).
| `src/constants/roles.ts` / `src/types/user.ts` permission model | **Frontend-only, disconnected from backend, includes a role that no longer exists** | `ROLE_PERMISSIONS` in `src/constants/roles.ts` defines a full permission matrix for `'super-admin' \| 'admin' \| 'sales-manager' \| 'sales-executive'` — but **`sales-manager` is not one of the backend's three `UserRole` values** (`SUPER_ADMIN`, `ADMIN`, `SALES_EXECUTIVE`). Nothing in the app currently reads `ROLE_PERMISSIONS` to gate anything (confirmed: not imported by sidebar, layout, or any page-level guard) — it exists but is inert. |
| Permissions Matrix (`/settings/roles`, `/users` → Permissions tab) | **Static display only, not authorization** | The component's own footer text says so explicitly: *"This is a frontend-only representation — actual authorization will be enforced by the backend."* Confirmed by code: no logic reads from or writes to this component. |

---

## 4. User Management
*The one feature that is fully real. Summarized here; full detail in prior session reports.*

| Item | Status |
|---|---|
| User list | **Real** — `GET /users`, verified live this session (network log shows `200 OK`, real Super Admin row rendered). |
| Search / Filtering | **Real, client-side** — filters the fetched list in-memory (`users-content.tsx`); not a backend query param, but operates on real data. |
| Create user | **Real** — `POST /users`, verified end-to-end in a prior session (created and deleted a test Sales Executive through the actual UI). |
| Edit user (name/role/department) | **Real** — `PATCH /users/:id`. Email field is intentionally `disabled` when editing since the backend doesn't support email changes. |
| Change role | **Real, backend-validated** — cannot promote to SUPER_ADMIN via this UI (backend rejects with 400; documented as an intentional business rule, not a bug). |
| Change department | **Real** — free-text field constrained to `DEPARTMENTS` constant, matches backend. |
| Activate/deactivate | **Real** — `PATCH /users/:id/status`, maps to Better Auth's `banned` flag on the backend. |
| Status handling | **Partial by design** — frontend only models `active`/`inactive` (binary); backend's third state `INVITED` collapses to `inactive` for display (documented in `src/features/users/api.ts`), and the status toggle never sends `INVITED`. Not broken — a deliberate, documented simplification. |
| Permissions Matrix | **Static** — see Section 3. |
| Error handling | **Real** — 409 duplicate email → inline field error; other errors → toast via `getFriendlyErrorMessage`. |
| Loading states | **Real** — `TableSkeleton` shown while `GET /users` is in flight. |
| Empty states | **Present** — `user-table.tsx`'s built-in empty state (unchanged, pre-existing). |

---

## 5. Dashboard

| Component | Data source | Status |
|---|---|---|
| KPI cards | `src/data/dashboard.ts` → `dashboardData.kpiMetrics` | Static |
| Revenue chart | `dashboardData.revenueData` | Static |
| Sales funnel / Pipeline snapshot | `dashboardData.salesFunnelData` / `pipelineData` | Static |
| Lead sources chart | `dashboardData.leadSourceData` | Static |
| Executive leaderboard | `dashboardData.executiveLeaderboard`, which pulls `users[4..7]` from **`src/data/users.ts`** | Static, and disconnected from the real backend Users feature — these are entirely different fake people (`Vikram Singh`, `Neha Gupta`, etc., with role `SALES_EXECUTIVE`/`SALES_MANAGER`) unrelated to any real database row. |
| Recent activities | `dashboardData.recentActivities` | Static |
| Upcoming follow-ups | `dashboardData` | Static |
| Today's Tasks | `initialTasks` (module const) in `todays-tasks.tsx`, toggled via local `useState` | **Genuinely interactive** (checkbox state persists within the session) but resets on refresh — correctly classified as frontend-only, not broken. |
| Quick Actions | Static links (`/clients/new`, `/enquiries/new`, etc.) | Links navigate correctly; destination pages are the same mock-backed forms audited elsewhere. |
| Navigation | Working | All sidebar/topbar links verified reachable with no console errors. |
| Runtime warning (reproducible) | — | `The width(-1) and height(-1) of chart should be greater than 0...` — a Recharts `ResponsiveContainer` sizing warning, fired 4 times on every Dashboard load (confirmed across multiple reloads). Non-blocking, cosmetic, does not break rendering. |

---

## 6. Clients

- **List** (`clients-content.tsx`): Real `useState` seeded from `@/data/clients` (25 generated companies). Search, status filter, table/grid view toggle all genuinely functional against that in-memory state.
- **Create/Edit** (`client-form.tsx`): Genuinely mutates local state via `onSubmit` callback (`clients-content.tsx:545-550`) — the most functional of the mock CRUD forms in the app, though still resets on refresh.
- **Delete / bulk delete**: Genuinely removes from local state (not backend) with a real confirmation dialog.
- **Detail page**: **Broken** — see C1 and C4.
- **Pagination**: Client-side only (`@tanstack/react-table`'s `getPaginationRowModel` over the full in-memory array) — will not scale to a real paginated backend without rework.
- **Empty/loading/error states**: Empty state present (both table and grid view). No loading state exists because data is synchronous (import-time), so there's nothing to show a spinner for yet. No error state exists for the same reason.
- **Static/mock data identified:** `src/data/clients.ts` (25 procedurally-generated Indian companies, contacts, addresses, revenue).
- **Backend endpoints that will eventually be required:** `GET /clients`, `GET /clients/:id`, `POST /clients`, `PATCH /clients/:id`, `DELETE /clients/:id` (or soft-delete/status pattern matching Users), plus a contacts sub-resource (`client.contacts[]` is currently nested, would need its own shape).

---

## 7. Products

- **List** (`products-content.tsx`): `mockProducts` recomputed **on every render** with `Math.random()` for price/stock — worse than the other mocks (see C3); table/grid toggle works against this unstable data.
- **Create/Edit form**: Fully non-functional — see C3.
- **Delete**: Button exists (`Trash2` icon) with **no `onClick` at all** — not even a fake toast.
- **Search**: Works against the (unstable) in-memory list.
- **Static/mock data identified:** inline `mockProducts` in `products-content.tsx` (30 items) **and** a separate, differently-shaped dataset in `src/data/products.ts` (30 items) — two disconnected product mocks exist in the codebase.
- **Backend endpoints required:** `GET /products`, `GET /products/:id`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`.

---

## 8. Enquiries

- **Kanban board** (`kanban-board.tsx` via `@dnd-kit`): **Genuinely functional** — drag-and-drop between stage columns correctly updates `enquiry.stage` in local state via `setEnquiries`. Resets on refresh, but not broken.
- **Table view**: Read-only rendering of the same state, functional.
- **Add Enquiry**: **Broken** — see C2.
- **Filter menu / sub-filter tabs**: Decorative, no handlers — see C7.
- **Status changes**: Only via drag-and-drop (functional, client-side); no direct "change stage" control elsewhere.
- **Static/mock data identified:** `src/features/enquiries/mock-data.ts` (`mockEnquiries`) — **a third, separate enquiry dataset**, disconnected from both `src/data/enquiries.ts` and `src/data/clients.ts`/`src/data/users.ts` (which `src/data/enquiries.ts` itself depends on). Two incompatible `Enquiry` type shapes exist in the codebase (`@/types/enquiry` used by the live feature vs `@/types` used by `src/data/enquiries.ts`).
- **Backend endpoints required:** `GET /enquiries`, `GET /enquiries/:id`, `POST /enquiries`, `PATCH /enquiries/:id` (stage/assignment/etc.), plus comments/timeline sub-resources per the richer shape in `src/data/enquiries.ts`.

---

## 9. Follow-ups

- **List/Calendar** (`follow-ups-content.tsx`): Own inline `generateMockData()` (30 items, random dates/types/priorities/status) — **a fourth independent mock dataset**, disconnected from `src/data/follow-ups.ts`.
- **Creation** (`follow-up-form.tsx`): Same fake-success pattern as Products — `toast.success('Follow-up scheduled successfully!')` with no persistence (confirmed via grep; not fully read line-by-line, but the pattern matches C3 exactly).
- **Editing/Status**: Not deeply verified this session; flagged for follow-up review given the creation form's pattern.
- **Search/filter**: Present in the UI; operates on the local mock array only.
- **Calendar/date handling**: Uses `date-fns` (`startOfMonth`, `eachDayOfInterval`, etc.) — genuinely computes a real calendar grid against the mock dates.
- **Backend endpoints required:** `GET /follow-ups`, `POST /follow-ups`, `PATCH /follow-ups/:id`.

---

## 10. Quotations

- **List** (`quotations-content.tsx`): Module-level `mockQuotations` (15 items, stable per page load since it's outside the component function — unlike Products). Search works against it. Action menu items are decorative (see C7).
- **Builder** (`quotation-builder.tsx`): Add/remove line items, quantity/price/discount/tax editing, and the GST math (CGST/SGST split, subtotal, grand total) are all **genuinely functional** client-side calculations.
- **Product selection**: Free-text field, not connected to the Products list/catalog at all (no autocomplete against `src/data/products.ts` or the Products feature).
- **Customer selection**: A single free-text `client` state field — not a real client picker connected to `src/data/clients.ts`.
- **Saving/Editing**: **Broken** — see C6.
- **PDF/print/export**: **Broken** — see C6. `quotation-preview.tsx` renders a print-style layout but generation is fake.
- **Status**: List shows status badges (Draft/Pending/Accepted/Rejected/Expired) from mock data; no UI exists to actually change a quotation's status.
- **Backend endpoints required:** `GET /quotations`, `GET /quotations/:id`, `POST /quotations`, `PATCH /quotations/:id`, plus PDF generation (likely a backend-rendered document, not purely client-side).

---

## 11. Sales

- `sales-content.tsx` generates `mockWonDeals` (6 items) and `mockLostDeals` (4 items) at module scope with `Math.random()` for value/executive/duration/reason — stable per page load. No console errors on navigation. Not deeply interaction-tested beyond confirming the page renders cleanly.
- **Backend requirement:** Sales is really a *view* over won/lost Enquiries/Quotations rather than its own entity — likely needs no dedicated backend model, just query endpoints/filters over Enquiries and Quotations once those are real (e.g., `GET /enquiries?stage=won`).

---

## 12. Reports & Analytics

- **Reports list** (`reports-content.tsx`): Static list of 6 report cards (Client/Sales/Revenue/Executive/Conversion/Monthly), each a `Link` to `/reports/[type]`.
- **Report viewer** (`report-viewer.tsx`): Renders per-type mock stats and a data table. "CSV"/"Excel" export buttons are fake (`toast.success("Exported to CSV")` / `"Exported to Excel"` — no file is produced). "Print" was not tested (likely uses `window.print()`, not verified).
- **Analytics dashboard** (`analytics-content.tsx`): Entirely hardcoded chart arrays (`revenueTrend`, `leadSources`, `funnelData`, `execRadarData`, heatmap). The period selector (`Tabs` bound to `period` state) changes the *active tab* but **the chart data arrays are not filtered by `period` anywhere in the file** — switching "Month/Quarter/Year" does not change what's plotted. Not verified with a live click-through this session (based on static analysis: no `period`-dependent branching exists in the data derivation).
- **Date ranges**: Report viewer shows a static date range string (`"Jan 01, 2026 – Aug 12, 2026"`), not an actual selectable range.
- **Backend requirement:** All of this needs real aggregation endpoints once Clients/Enquiries/Quotations have real data — reports and analytics are inherently *derived* views, so they should be the **last** thing built, not first (see Section 17).

---

## 13. Settings

Every settings page follows the same pattern: local `useState` (or nothing) + a fake success toast on submit, no backend persistence.

| Page | Status |
|---|---|
| Company | Frontend-only form, `toast.success` on submit, no persistence. |
| Branding | Frontend-only, color picker + logo state, `toast.success`, no persistence. |
| Integrations | No `useState`/mock-data/toast patterns found — appears to be a static display (not deeply read this session; flagged as needs review). |
| Email Templates | Frontend-only, `toast.success` on save, no persistence; template list appears hardcoded. |
| Backup | Frontend-only; `mockBackups` list; "Run backup" triggers `toast.info(...)` only. |
| Audit Logs | Frontend-only; `generateMockLogs()` produces 30 fake entries per load. |
| Roles | Reuses the static `PermissionsMatrix` (see Section 3) — display only. |
| Taxes | Frontend-only; local `useState(initialTaxes)`, delete/add mutate local state only, `toast.success` on delete. |

All settings pages loaded without console errors during this session's sweep.

---

## 14. Global UI

- **Sidebar**: Static nav list, no role-based filtering (see Section 3). No errors.
- **Topbar**: User menu dropdown fixed and verified working this session's predecessor (see below). No errors.
- **Command palette** (`Ctrl+K`): Fixed and re-verified this session — see below.
- **Dropdown menus**: `dropdown-menu.tsx`'s `GroupLabel`-without-`Group` bug was fixed in a prior session; re-verified this session (Topbar user menu opens, filters correctly, no console error). **A structurally identical, currently-dormant bug exists in `select.tsx`** — see C5.
- **Modals/Dialogs**: `AlertDialog` (delete confirmations), `Dialog` (forms) — no errors observed across every page visited.
- **Forms**: `react-hook-form` + `zod` used consistently where forms are actually wired (Users, Clients, Products-schema-only, Follow-ups-schema-only); Enquiry form is the one exception with no form library wiring at all (see C2).
- **Toasts**: `sonner`, globally mounted in `src/app/layout.tsx`, working throughout — but see the extensive "fake success toast" pattern noted in Sections 6-13, which is a UX-honesty concern more than a technical one.
- **Loading states**: Only implemented in the Users feature (`TableSkeleton`). No other feature has a loading state, consistent with all other data being synchronous mock imports (nothing to load).
- **Error states**: Only implemented in the Users feature (`ErrorState`). No other feature can currently error (no network calls to fail).
- **Empty states**: Present in Clients (table + grid), Users, and several list/table components; absent in some others (e.g., Quotations list shows a plain "No quotations found." text, not the shared `EmptyState` component).
- **Search**: Present per-feature (all client-side `.filter()` against in-memory arrays) plus a dedicated `/search` page (`search-content.tsx`, not deeply inspected this session). No global/cross-feature search.
- **Notifications**: `notification-bell.tsx` + `/notifications` page, backed by `src/data/notifications.ts` (50 generated fake notifications). No errors observed.
- **Theme switching**: Toggle present in Topbar (`next-themes`); not deeply exercised this session but no errors observed when navigating with it available.
- **Responsive behavior**: **Not verified** — no viewport-resize testing was performed this session.

---

## 15. Mock / Static Data Inventory

| File | Data | Current Source | Real Persistence? | Backend Needed? |
|---|---|---|---|---|
| `src/data/clients.ts` | 25 generated companies + contacts/addresses | Procedural generation at module load | No | Yes — Clients API |
| `src/data/products.ts` | 30 generated products | Procedural generation at module load | No | Yes — Products API |
| `src/data/users.ts` | 8 fake employees (incl. legacy `SALES_MANAGER` role) | Static array | No | Superseded by real Users API; this file is now dead weight feeding the Dashboard only |
| `src/data/enquiries.ts` | Generated from `clients`+`users` | Procedural | No | Yes — Enquiries API |
| `src/data/follow-ups.ts` | Generated from `clients`+`users` | Procedural | No | Yes — Follow-ups API |
| `src/data/quotations.ts` | Generated from `clients`+`products`+`users` | Procedural | No | Yes — Quotations API |
| `src/data/notifications.ts` | 50 generated notifications | Procedural | No | Yes — Notifications API (or derive from real events) |
| `src/data/dashboard.ts` | KPIs, chart series, leaderboard, activity feed | Static + references `src/data/users.ts` | No | Yes — aggregation endpoints (build last) |
| `src/features/enquiries/mock-data.ts` | `mockEnquiries` | Separate procedural generator | No | Duplicate of `src/data/enquiries.ts`'s purpose with a different type shape |
| `src/features/products/products-content.tsx` (inline) | `mockProducts`, recomputed every render | Inline `Array.from(...).map()` with `Math.random()` | No | Duplicate of `src/data/products.ts` |
| `src/features/quotations/quotations-content.tsx` (inline) | `mockQuotations` | Module-level inline generator | No | Duplicate of `src/data/quotations.ts` |
| `src/features/sales/sales-content.tsx` (inline) | `mockWonDeals`, `mockLostDeals` | Module-level inline generator | No | Derived view, no dedicated backend needed |
| `src/features/follow-ups/follow-ups-content.tsx` (inline) | `generateMockData()` (30 items) | Inline generator | No | Duplicate of `src/data/follow-ups.ts` |
| `src/features/analytics/analytics-content.tsx` (inline) | Revenue/lead-source/funnel/radar/heatmap arrays | Hardcoded constants | No | Yes — analytics aggregation |
| `src/features/settings/*.tsx` (various) | Company profile, branding, backups, audit logs, taxes, email templates | Hardcoded/`useState` | No | Yes, per settings area, low priority |
| `src/features/reports/reports-content.tsx` | Static list of 6 report types | Hardcoded array | N/A (navigation only) | N/A |
| `src/features/reports/report-viewer.tsx` | Per-type mock stats/table | Hardcoded per `type` param | No | Yes — reporting endpoints |
| `src/features/dashboard/todays-tasks.tsx` | 6 tasks, toggle state | `useState`, resets on refresh | Session-only (real React state, not fake) | Optional — could stay client-local or become real tasks |
| `src/features/users/*` | Real users | `GET/POST/PATCH /users` | **Yes** | Already built |

---

## 16. Frontend ↔ Backend Gaps

| Feature | Frontend Status | Backend Status | Required Work |
|---|---|---|---|
| Users | Fully wired | Fully implemented (Better Auth + Prisma, org-isolated, RBAC) | None — done |
| Auth (login/session/logout) | Fully wired | Fully implemented | None — done |
| Clients | Mock CRUD (local state), broken detail page | **Does not exist** | Build `Client`/`Contact` Prisma models + CRUD API; fix C1/C4 as part of real wiring |
| Products | Mock list, non-functional forms | **Does not exist** | Build `Product` model + CRUD API; fix C3 as part of real wiring |
| Enquiries | Functional Kanban (local), broken create form | **Does not exist** | Build `Enquiry` model + CRUD/stage-update API; fix C2 as part of real wiring; reconcile the 3 disconnected mock type shapes first |
| Follow-ups | Mock list/calendar, fake create | **Does not exist** | Build `FollowUp` model + CRUD API |
| Quotations | Functional builder math, fake save/PDF | **Does not exist** | Build `Quotation`/`LineItem` model + CRUD API + PDF generation strategy (backend-rendered likely) |
| Sales | Mock derived view | **Does not exist** (would derive from Enquiries/Quotations) | Query/filter endpoints once Enquiries+Quotations are real |
| Reports/Analytics | Mock everywhere | **Does not exist** | Aggregation endpoints — depends on all of the above existing first |
| Settings (Company/Branding/Taxes/Email Templates/Backup/Audit Logs) | Mock forms | **Does not exist** | Low-priority CRUD/config endpoints per area |
| Notifications | Mock feed | **Does not exist** | Either a real notifications table/feed or derive from domain events once those exist |

---

## 17. Recommended Implementation Order

*Dependency-aware, not menu-order. Reasoning: everything in this CRM ultimately hangs off a Client; Enquiries/Quotations reference Clients and (for line items) Products; Follow-ups reference Clients and Enquiries; Sales is a filtered view over Enquiries/Quotations; Reports/Analytics aggregate all of the above. Users/Auth/Org-isolation is already done and is the foundation everything else's authorization sits on.*

1. **Clients backend** (blocks everything else — Enquiries, Quotations, Follow-ups, and the Client detail page all need a real client to reference). Fix C1/C4 as part of this, not before — they only matter once there's real data to look up.
2. **Products backend** (needed before Quotations can have real line items; needed before Products' own broken create form (C3) is worth fixing for real, rather than against disposable mock data).
3. **Enquiries backend** (depends on Clients; the Kanban interaction is already proven functional client-side, so this is mostly "swap local state for API calls" plus fixing C2's form from scratch).
4. **Follow-ups backend** (depends on Clients and, loosely, Enquiries).
5. **Quotations backend** (depends on Clients and Products; the builder math is already correct, so this is "persist what's already computed" plus fixing C6).
6. **Sales** (no new backend model — build once Enquiries + Quotations are real, as query/filter endpoints over them).
7. **Reports & Analytics** (must be last — they're aggregations over everything above; building them earlier means building them twice).
8. **Settings** (independent of the above; can be done in parallel by a second workstream at any point, lowest priority since nothing else depends on it).
9. **Notifications** (either stays client-local, or is wired last as a byproduct of whichever domain events you want to notify on).

---

## 18. Pre-Clients Blockers

Concise list of what must be fixed or decided **before** Clients backend implementation begins:

1. **None of the Critical Issues (C1-C7) technically block starting Clients backend work** — they're bugs in the *current mock UI*, and Clients backend work will replace the client-list/detail data layer anyway (naturally resolving C1 and C4 as a side effect of wiring real data).
2. **Decide the Client data shape.** Two incompatible shapes currently coexist for "a client": `src/data/clients.ts`'s `Client` type (`@/types`, used by `client-detail-content.tsx`'s type-adjacent code) vs. `ClientRecord` (defined inline in `client-form.tsx` and re-mapped in `clients-content.tsx` from the `Client` fixtures via a manual adapter, lines 77-117). Building the backend against one and discovering the frontend expects the other mid-way is avoidable by resolving this first — pick one shape (or design the API response and write one clean mapper, the same pattern already proven for Users in `src/features/users/api.ts`).
3. **Confirm organization-scoping expectations for Clients**, matching how Users are org-isolated on the backend already — if Clients should also be org-scoped, that's a one-line addition to the Prisma model at the time it's created, not a retrofit.
4. **No blocker from Authentication/Authorization** — both are solid and already proven against a real feature (Users).

---

## 19. Non-Blocking Issues

Safe to postpone:

- C5 (dormant `SelectLabel` bug) — not blocking anything since nothing uses it; worth a one-line fix whenever it's convenient, ideally before anyone reaches for `SelectGroup`/`SelectLabel` in new code.
- C7 (decorative dropdown menu items) — cosmetic until the underlying data is real; fixing now means fixing twice.
- Recharts sizing warning on Dashboard — cosmetic console noise, not a functional break.
- Demo login buttons on the login page — dead but harmless.
- `src/constants/roles.ts` / `sales-manager` legacy role — inert dead code, not read by anything live.
- Multiple disconnected mock datasets per entity (Section 15) — only matters at the moment each feature's backend gets built; no need to reconcile them speculatively now.
- Settings pages — explicitly low priority per Section 17.
- Analytics period-selector not actually filtering data — cosmetic until Analytics is rebuilt against real aggregation endpoints anyway.
- Responsive behavior — not verified, but no evidence of a specific problem either; worth a dedicated pass later, not urgent.

---

## 20. Final Readiness Score

**~20% ready for the "build the CRM backend" phase to proceed feature-by-feature without rework.**

Basis for the number:
- **Foundation (Auth, Authorization, Org isolation, Users CRUD): ~95% done, verified working.** This is the hardest, highest-risk part of a multi-tenant CRM and it's solid.
- **Every other domain feature (Clients, Products, Enquiries, Follow-ups, Quotations, Sales, Reports, Settings): ~0% backed by real persistence.** The *frontend UI shells* for these are substantially built (often 60-90% visually complete per feature) and in a few cases (Kanban drag-and-drop, quotation line-item math, client CRUD-against-local-state) the *interaction logic* is already correct and will transfer directly once wired to a real API — but none of it currently touches a database, and several specific paths are actively broken rather than merely unbuilt (C1-C4, C6).
- The weighted score leans low overall because the audit's actual purpose — "what must be fixed or implemented before we continue building the CRM backend" — is asking about *backend readiness*, and 9 of 10 domains have no backend at all yet. The 20% reflects that the foundation this all sits on is genuinely solid, but the amount of backend work remaining is close to the full scope of the CRM.
