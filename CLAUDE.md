# Staff Dashboard — project guide

Static, no-build, Excel-look-alike staff analytics dashboard. Three HTML pages
share one `script.js` (~7000 lines, single `StaffApp` object), one `style.css`
and one `data.js` mock-data file. No bundler, no framework, no package.json —
open the HTML files through a static server and it just works.

## Files

| File | Role |
|---|---|
| `dashboard.html` | Tech Block (aggregate) page **and** every center page — same file, `?center=<id>` query param picks the center client-side |
| `employees.html` | Сотрудники (employee list + filters) |
| `employee.html` | Single employee page, `?id=<n>` |
| `script.js` | All logic. One object literal, `const StaffApp = {...}`, exposed via `window.initApp` / `DOMContentLoaded` |
| `style.css` | All styling. **Read the warning below before touching this file.** |
| `data.js` | `window.mockData` — centers, managements, employees, tasks. All data is static/mock, no backend. |
| `vendor/` | `chart.umd.js` (Chart.js), `xlsx.full.min.js` — only xlsx.full.min.js's import path is loaded but not really exercised; charts use Chart.js |
| `index.php`, `staff-ui.js` | **Legacy/unused.** Not referenced by any HTML or by script.js. Confirmed via grep repeatedly this project — leave untouched unless explicitly asked about them. |

## ⚠️ style.css has mixed CRLF/LF line endings — critical editing rule

`style.css` was hand-edited outside this tool at some point and has a mix of
`\r\n` and `\n` line endings scattered through it. **Never use the `Edit` tool
on `style.css`.** It normalizes whatever chunk it touches to one line-ending
style, which turns a 10-line intentional diff into an 800-line diff of pure
whitespace churn — this has happened multiple times in this project's history
and had to be reverted and redone.

Always edit style.css with the binary-safe Python pattern instead:

```python
with open('style.css', 'rb') as f:
    data = f.read()
old = b'...'   # or a Python str encoded via .encode('utf-8') if it has Cyrillic
assert data.count(old) == 1
data = data.replace(old, new)
with open('style.css', 'wb') as f:
    f.write(data)
```

- Match the **exact** line ending present at that spot (check with `cat -A
  style.css | sed -n '<N>,<M>p'` — `$` = LF, `^M$` = CRLF).
- New rules are conventionally **appended at the very end of the file** (it
  ends cleanly with `}\n`) rather than inserted mid-file — avoids fragile
  cascade-order bugs from squeezing a rule between two existing ones.
- **Always verify after editing:** `git diff --stat style.css` must equal
  `git diff --ignore-all-space --stat style.css`. If they differ, you just
  reintroduced line-ending churn — revert (`git checkout -- style.css`) and
  redo it with the byte-safe method.

`script.js` and the HTML files are plain LF and are Edit-tool-safe. Still sanity
check `node -c script.js` and `git diff --check` before committing.

## Data model (data.js → `window.mockData`)

- **8 centers**, ids: `alpha, vector, orbita, impulse, sphere, granit, pulsar,
  kontur`. Each has a long descriptive industrial `name` (e.g. "Центр
  центробежных насосов, центробежных компрессоров и роторных машин") and a
  `shortName` codename (Альфа, Вектор...) that is **mostly legacy** — real UI
  now shows `StaffApp.getCenterAbbreviation(center.name)` instead (first
  letter of every word in the full name, e.g. → "ЦЦНЦКИРМ"), matching what the
  sidebar's own center dropdown has always shown. `shortName` only survives as
  a defensive fallback in a couple of spots.
- **8 employees**, 1 per center (`employees[i].centerId`). `employee.status`
  drives the Табель/absence categorization (`'В работе'`, `'В отпуске'`,
  `'Командировка'`, etc.) — see `getAbsenceCategoryForStatus`.
- **Managements** sit under centers (`management.centerId`); center pages
  break some metrics down by management the way Tech Block breaks them down
  by center.
- **Tasks** are the atomic project unit; `getProjectsForMatrix(centerId)`
  reshapes an employee's tasks into "project" rows (id, type, status, dates,
  plan/actual hours) used everywhere: the Проекты table, Целевой показатель,
  Уведомления по проектам. Task `comment` text is **not** a data.js field — see
  below.

## Page routing & rendering

- `document.body.dataset.page` (set in each HTML file's `<body data-page="...">`)
  picks the page in `StaffApp.renderPage()`: `'employee'` / `'employees'` /
  else Tech Block or a center page.
- Tech Block vs. a specific center is the **same page** (`dashboard.html`),
  disambiguated by `?center=<id>` via `getCurrentCenterId()`.
- Page-to-page navigation crossfades through a transition system:
  `.view-transition-root > .view-layer--current` (normal flow) +
  `.view-layer--next` (`position:absolute; inset:0`, hidden until commit).
  `renderWithTransition()` drives the crossfade. Any code that captures a DOM
  container reference and reuses it after a transition **must** rebind against
  a persistent node it queried fresh, not the original container reference —
  the container can become the emptied `.view-layer--next` after commit (its
  children get *moved*, not recreated). See `bindProjectsMatrixHandlers` for
  the reference pattern (comment there explains the bug it fixes).
- Custom dropdowns/calendars (period-unit picker, date fields) are portaled to
  `#floatingPanelsRoot` (a body-level div) when opened, `position:fixed`, so
  they escape any ancestor's `overflow:hidden`/`transform` clipping. Z-index
  150, above `.floating-panel`/employee-preview modal (101). A capture-phase
  `scroll` listener closes them on page scroll but explicitly ignores scroll
  events that originate *inside* the panel itself.

## Side panel (Tech Block + every center page)

`renderDashboardSidePanel(centerId, isTechBlock)` renders, top to bottom:
**Целевой показатель** → **Уведомления по проектам** → **Табель** →
**Загрузка ресурсов**. All four are ported/adapted features, not in the
original site — each documented briefly:

- **Целевой показатель**: commercial/investment projects' on-time / in-budget
  completion rate. Has an "I/II полугодие 2026" period filter
  (`getTargetIndicatorPeriods`, filters by task `dueDate`). Tech Block shows
  one aggregated summary across all centers at a larger font
  (`target-indicator-metrics--large`); center pages show the same layout at
  normal size, scoped to that center. "ID задач в расчёте" and "Комментарии"
  are both `<details>` dropdowns at the bottom (click to expand a list).
- **Комментарии / project comments**: this dataset has no comment field on
  tasks. `getProjectComment(taskId)` deterministically assigns one from a
  fixed Russian-text pool to ~1 in 4 tasks (`taskId % 4 === 0`), purely
  derived — no data.js changes. Same comment also shows as a small "!" flag
  next to the project ID in the Проекты table's expanded rows.
- **Уведомления по проектам**: overdue / over-budget-hours / missing-plan-hours
  project counts, computed from the same `getProjectsForMatrix` fields already
  used for the Проекты table's status badges (`dateTone`, `hoursTone`,
  `hasPlan`) — scoped to non-completed projects.
- **Табель**: absence breakdown by category, from `employee.status` via
  `getAbsenceCategoryForStatus`. Expand/collapse per category.
- **Загрузка ресурсов**: per-center (Tech Block) or per-management (center
  page) average load bar, plus a "X сегодня" count of employees currently
  *not* in an absence category (`getEmployeesWorkingToday`).

## Dev workflow

Serve the static files with PHP's built-in server (no build step needed):

```bash
nohup php -S 127.0.0.1:<port> -t /home/user/Staff_dashboard > /tmp/php_x.log 2>&1 & disown
```

Ports drift a lot across sessions/turns because the process doesn't survive
context resets — always `curl -s -o /dev/null -w "%{http_code}\n"
http://127.0.0.1:<port>/dashboard.html` before assuming a server is up, and
just start a fresh one on a new port if it's down. Never assume a previously
started server is still running.

Verification is Playwright-driven (`/opt/pw-browsers/chromium` via
`/opt/node22/lib/node_modules/playwright`), scratch scripts under
`/tmp/claude-0/.../scratchpad/` (or `/tmp/` for the two long-lived ones below).
Standing regression scripts — re-run before every commit:

- `/tmp/verify_task_ab.js` — overflow + console-error checks across a few
  viewports/pages, plus period-switcher/unit-select height checks.
- `/tmp/verify_icons.js` — overflow + console errors on employee.html.

Both currently point at whatever port was live last session — `sed -i
's/127\.0\.0\.1:OLDPORT/127.0.0.1:NEWPORT/g'` them onto the port you actually
started before running.

**Known, pre-existing, unrelated issue — do not "fix" it as a side effect of
other work:** `[employees @1024/900] HORIZONTAL OVERFLOW` on the employees
table at narrow viewports. It's a baseline condition of the repo, not a
regression from any of the work described here.

For a quick full-matrix check after touching centers/side-panel code, loop
`StaffApp.getCentersList()` and visit `dashboard.html?center=<id>` for each,
checking for console errors, overflow, and that the card of interest exists —
see any `verify_all_centers.js`-style script in recent history for the
pattern.

## Git workflow

- Working branch: `claude/code-review-design-fixes-5g0vyg`.
- **Always `git fetch origin claude/code-review-design-fixes-5g0vyg` and
  compare `HEAD` vs. `origin/...` before pushing.** The repo owner has
  directly modified this branch on GitHub via delete + "Add files via upload"
  more than once — a plain `git push` can get rejected ("fetch first"). If it
  happens, diff against the new origin HEAD (files have turned out
  byte-identical every time so far, just with unrelated new files added) and
  reconcile rather than force-pushing blindly.
- Commit messages: explain the root cause / "why", not just "what changed".
  End with the `Co-Authored-By` / `Claude-Session` trailers (see recent commit
  history for the exact format).
