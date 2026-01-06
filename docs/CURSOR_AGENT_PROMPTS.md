### Cursor agent prompts (CFMEU repo)

This file is a copy/paste “prompt pack” for Cursor. Prompts are designed to produce durable artifacts: architecture maps, permission audits, and mobile UX checklists before implementation.

Reference context: `claude.md`, `docs/ARCHITECTURE.md`, and `docs/DEBUGGING_PLAYBOOK.md`.

### Prompt 0 — Session initializer (use first)
Paste this at the start of any substantial session:

```
You are an expert debugging and implementation agent for the CFMEU organiser platform.

Hard constraints:
- Mobile-first (iPhone 13+); do not regress known overlay/header/drawer opacity requirements.
- RLS is authoritative for permissions; never “fix” access by client-side hiding or broadening.
- Prefer server-side filtering/pagination; avoid fetching all then filtering.
- Multi-service reality: bugs may be in Next app, workers, or Supabase/RLS/migrations.
- Do not run any git commands unless I explicitly approve each command.

When debugging: collect evidence first (repro steps, role, environment, URL, network/logs), then propose the minimal fix and the smallest regression net (favor mobile tests when UI is touched).
```

### Prompt A — Repo architecture map (first-run)
```
Act as a staff engineer onboarding to this repo. Read the codebase and produce:
1) a 1-page architecture summary (services, data stores, critical paths)
2) a route map of `src/app` grouped by workflow (mapping/compliance/delegates/discovery/employers)
3) one end-to-end request flow (pick either mobile audit or project mapping)

Requirements:
- Cite file paths for every claim
- Do not propose fixes yet
```

### Prompt B — Auth/session + permission enforcement
```
Find how authentication is established in the Next app and how role/patch permissions are enforced end-to-end (client → API routes → Supabase).

Output:
- Key modules and entry points (paths)
- Where role is read and enforced
- Where patch assignments are applied
- Where RLS policies live (migration filenames)
- Any places where the UI filters client-side instead of server-side
```

### Prompt C — Mobile UX regression hunter
```
Scan `/mobile` routes and shared layout/navigation components.

Output:
- A repo-specific checklist of mobile regression risks (overflow, sticky headers/drawers, dialogs/overlays, touch targets)
- The exact components/files implementing those patterns
- A minimal Playwright mobile regression net (which test(s) to run for this change)
```

### Prompt D — Performance/large dataset audit
```
Identify pages/queries likely to hit large datasets (projects, employers, mapping views).

Output:
- Where queries are made (paths)
- Which views/materialized views exist for them (migration filenames)
- Any client-side filtering/pagination smells
- An observability plan (what to log/measure) before changing code
```

### Prompt E — Supabase schema & migrations orientation
```
Summarize the Supabase schema for the core domain:
- projects, job_sites, employers, patches, project_employer_roles, site_employers, profiles

Output:
- Relationships and which table is used for what
- Key enums
- The “top 20” migrations that define security/RLS and performance (filenames + what they do)
- A short index: “if X breaks, look at Y”
```

### Prompt F — Bug-specific triage tree (best for day-to-day)
```
I’m seeing:
- Bug:
- Steps:
- Role:
- Environment:
- URL/path:
- Expected:
- Actual:

Build a triage tree:
1) what evidence to collect (UI/network/logs/DB/RLS)
2) likely layers involved
3) exact files to inspect first

Only after evidence collection: propose the minimal fix + smallest regression net.
```

### Model selection (practical)
- Use the **strongest reasoning/code model** for:
  - permissions/RLS
  - cross-file refactors
  - subtle mobile UI constraints
- Use a **fast/cheap model** for:
  - file discovery (“where is X handled?”)
  - generating candidate areas to inspect, then escalate


