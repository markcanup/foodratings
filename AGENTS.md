# AGENTS.md

## Project
- Repository name: `foodratings`
- Canonical repository: `https://github.com/markcanup/foodratings`
- Stack: React + Vite
- Primary workspace for Codex Desktop: `/home/codex/foodratings/source`
- Primary workspace in the project container: `/workspace`
- Codex should only read and modify files inside this folder.

## Workspace
- Host path: `~/foodratings/source`
- Container path (Codex runtime): `/workspace`
- Codex will typically operate inside `/workspace`, which is a mounted view of the host repository.

## Git Workflow
- `origin` must point to `https://github.com/markcanup/foodratings`.
- Before beginning new work, fetch `origin` and confirm the tracked files on local `main` match `origin/main`.
- Preserve local untracked environment/helper files unless the user explicitly asks to add or remove them.
- Create a feature branch from the current `origin/main` for implementation work; use a short, descriptive name such as `codex/<task-name>`.
- Do not commit or push changes unless explicitly asked.

### Git object permission workaround

Some legacy loose-object directories under `.git/objects` are owned by another
workspace user or group. Git may therefore fail during `git add` or `git commit`
with `insufficient permission for adding an object to repository database`, even
when refs and the index remain writable. Repacking a completed commit does not
permanently repair every legacy loose-object directory.

When the user has explicitly requested a commit and this specific error occurs,
use a temporary alternate object store, then repack the resulting commit into
the repository's normal pack storage. Run these commands from the repository
root, replacing the staged paths and commit message as appropriate:

```bash
foodratings_git_objects=$(mktemp -d /tmp/foodratings-git-objects.XXXXXX)

GIT_OBJECT_DIRECTORY="$foodratings_git_objects" \
GIT_ALTERNATE_OBJECT_DIRECTORIES="$PWD/.git/objects" \
git add <paths>

GIT_OBJECT_DIRECTORY="$foodratings_git_objects" \
GIT_ALTERNATE_OBJECT_DIRECTORIES="$PWD/.git/objects" \
git commit -m "<message>"

GIT_ALTERNATE_OBJECT_DIRECTORIES="$foodratings_git_objects" git repack -a
git cat-file -e HEAD^{commit}
git status --short --branch
```

Only remove the temporary directory after both verification commands succeed.
After repacking, ordinary Git commands and a normal `git push` must work without
the alternate-store environment variables. Do not change ownership recursively
or leave a branch pointing to objects that exist only in `/tmp`.

## Execution Environment
- Codex runs inside a containerized Node environment
- The container has access only to `/workspace`
- Development secrets are injected at runtime and are not stored in the repository.
- The user performs all builds and runtime testing outside Codex

## Runtime and secrets
- Codex may run the app locally against the development Supabase project only.
- Development environment variables are provided at runtime and are not stored in the repository.
- Never assume production credentials or production database access.
- Do not print secret values in output, logs, or documentation.
- Only use the environment variables required to run the app locally.

## Path Rules
- Always use relative paths from the repository root
- Do not use absolute paths unless explicitly required
- Assume current working directory is the repository root

## Purpose
This is the source code for the Food Ratings application.

## Working Model
- Codex edits code locally in the repository on the Linux server.
- The user tests changes manually by rebuilding and running a local container.
- The user performs all Git commits manually after testing.
- Production deployment happens separately through GitHub -> Netlify after the user commits and pushes.

## Important Constraints
- Do not access, assume, or depend on secrets.
- Do not require access to environment files outside `~/foodratings`.
- Do not attempt to run container builds, deploys, or other workflows that require secrets.
- Follow the Git workflow above for commits and pushes.

## Build / Test Expectations
- The user handles container rebuilds and runtime testing manually.
- Codex should focus on code changes only.
- If a proposed change would normally require building or testing, say so clearly in the summary.
- If verification is needed, describe what the user should test manually.

## Database Guidance
- Supabase client code is located at `src/supabaseClient.js`.
- Codex may update application code that uses Supabase.
- Production and development use separate Supabase projects.
- Never assume production database access.
- Development Supabase credentials are injected at runtime; never commit or print them.
- All schema changes must be represented as migration files in `supabase/migrations`.
- The migration files are the repository source of truth for table and column definitions, including `external_*` tables.
- If the development database is ahead of the checked-in migrations, pull or otherwise capture its schema in a new migration before writing code that depends on it; never guess table or column definitions.
- `supabase/migrations/20261023_external_order_import.sql` records the `external_*` schema applied to both development and production.
- `supabase/migrations/20261030120000_external_sync_requests_realtime.sql` enables immediate queue wake-ups; apply it after the external sync request migration.
- Do not make undocumented schema-only edits.
- For local testing, target the development Supabase project only.
- When a schema change is made, also update any affected app code and documentation.
- Codex should assume all testing targets the development project only.
- Apply schema changes to development first; production promotion is a separate manual step.

## Environments
There are two environments:
1. Local development on the Linux server
2. Production on Netlify

Codex should optimize for local code changes that the user will test manually first.

## Change Strategy
- Prefer small, simple, targeted changes.
- Avoid mixing UI changes with logic or behavior changes unless explicitly requested.
- For large UI updates, keep functionality unchanged unless the user asks otherwise.
- Minimize the scope of each change.
- Preserve existing behavior unless the task specifically requires changing it.

## Code Quality Rules
- Keep names of variables, functions, props, and components consistent across files.
- Before finishing, verify that any renamed symbol is updated consistently everywhere it is used.
- Avoid unnecessary renames or refactors.
- Avoid introducing new dependencies unless clearly justified.
- Follow the existing project style and patterns.
- Prefer minimal, readable solutions over broad rewrites.

## Documentation
- Create documentation when it is missing and useful.
- Update documentation whenever behavior, structure, setup, or usage changes.
- Keep documentation practical and concise.
- Prefer repo-local documentation files such as `README.md` or focused docs for specific features.
- Store documentation in the docs folder.

## When Making Changes
Codex should:
1. Read the relevant files first
2. Make the smallest reasonable change
3. Keep naming and structure consistent
4. Note any manual testing the user should perform
5. Note any SQL the user must run manually for schema changes
6. Note any documentation updates included or still needed

## What to Avoid
- Do not modify files outside `~/foodratings`
- Do not assume access to hidden configuration or secret files
- Do not bundle unrelated fixes together
- Do not change logic during a UI-only task
- Do not make schema changes silently
- Do not introduce inconsistent naming across files
