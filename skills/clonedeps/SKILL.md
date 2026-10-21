---
name: clonedeps
description: Clone important dependency source code into an ignored local workspace so the agent can inspect library internals. Use when the user asks to clone dependencies, inspect dependency source, understand SDK/framework behavior from source, or debug library implementation details.
---

# Clonedeps Skill

You help users make a small set of important dependency source repositories
locally readable.

This is a workflow skill, not a command wrapper. Do not use a helper script for
dependency detection, ref validation, cloning, status, or cleanup. The
orchestrator and the explorer seat do the repo-specific thinking; the
orchestrator performs the approved filesystem/git operations directly.

## Step 1 — Check Existing State

First check whether `.dsh/clonedeps.json` exists.

If it does:

1. Read it before asking the explorer seat for a new plan.
2. Check whether each listed `path` exists under `.dsh/clonedeps/repos/`.
3. Reuse existing clones when they already satisfy the task.
4. Only ask for new recommendations when the manifest is missing, stale, or
   insufficient for the current task.

Do not rescan and re-plan from scratch when the manifest already has useful
entries.

## Step 2 — Ask the Explorer Seat for the Clone Plan

Delegate dependency discovery and source resolution to the explorer seat with
this brief:

> Understand this project first, then recommend remote source repos that would
> help a developer work on it. Read enough of the current repo to understand
> what the project does, its main architecture, the important integration
> points, and which external systems or libraries it depends on in practice.
>
> Think like a developer trying to debug or extend this project. Which remote
> repositories, if cloned locally, would actually help understand the codebase
> or solve likely implementation/debugging tasks?
>
> Do not make a dependency dump — most dependencies are not worth cloning.
> Recommend a repo only when its source would be more useful than docs or the
> current repo alone.
>
> For each recommendation give: repo name, repo URL, suggested ref/tag/commit if
> known, why cloning this source would help, when it would be useful, and
> caveats. Also list current-repo files to inspect first, and repos you
> considered but would not clone. Keep it small: prefer 0–3 strong
> recommendations over 5 weak ones. If nothing clearly needs cloning, say so.

The plan should yield, per dependency: name, current version or range if
discoverable, official source repository URL, the tag/commit to check out, the
package subdirectory if the source is a monorepo, why local source helps, and
caveats (huge repo, missing tag, uncertain version mapping).

Prefer at most 3–5 core dependencies. Do not clone tiny utilities,
transitive dependencies, or dev-only tools unless they are directly relevant.

## Step 3 — Verify and Confirm

The orchestrator owns final approval. Before cloning:

1. Verify refs where possible with `git ls-remote`.
2. Prefer pinned tags or commit SHAs; if no exact tag exists, ask for the
   correct module-specific ref or explain the fallback.
3. Use HTTPS GitHub/GitLab-style URLs by default. Reject `file://`, SSH URLs,
   local paths, URLs with embedded credentials, and private or auth-required
   repositories unless the user explicitly approves that case.
4. Present the plan with dependency, repo URL, ref, reason, and caveats.
5. Ask for confirmation before network cloning unless the user already asked
   to clone immediately.

## Step 4 — Update the Ignore File

Before cloning artifacts or cleaning up, inspect the existing `.gitignore`.
Update the managed block in place when present; otherwise append it. Add only
the missing exact lines below, never duplicate entries, never modify
unrelated rules.

```gitignore
# BEGIN oh-my-dsh clonedeps
.dsh/clonedeps/repos/
# END oh-my-dsh clonedeps
```

## Step 5 — Clone Manually

Create one folder per source repository under:

```text
.dsh/clonedeps/repos/<safe-repo-name>/
```

Derive the safe name from the repository owner/name, not from the package
name: `https://github.com/opencode-ai/opencode.git` becomes
`opencode-ai__opencode`. Replace `/` with `__`, strip common `.git` suffixes,
and replace other unsafe path characters with `_`.

If several packages come from one monorepo, clone the repository once and
point each manifest entry at the same repo path with different `packagePath`
values. No ecosystem folders, per-package clone folders, or per-version
folders. If two repositories normalize to the same safe name, disambiguate
manually and record the chosen path in `.dsh/clonedeps.json`.

Clone and fetch with normal git commands. For an existing clone, first verify
that `git remote get-url origin` matches the approved repo URL; if it does not
match, stop and ask whether to clean or re-clone.

Safe manual git pattern:

1. `git ls-remote <repoUrl> <ref>` to verify the ref where practical.
2. Clone without submodule or recursive behavior.
3. Prefer a shallow fetch/clone where practical.
4. Clone into a temporary directory under `.dsh/clonedeps/repos/`, then move
   it into the final safe-name path after checkout succeeds.
5. Remove failed temporary clones.

Do not run install, build, or test scripts from cloned repositories.

## Step 6 — Write Local State

Write `.dsh/clonedeps.json` so future agents know what exists:

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-05-12T00:00:00.000Z",
  "dependencies": [
    {
      "name": "@deepseek-ai/cordis",
      "resolvedVersion": "0.2.1-rc.2",
      "repoUrl": "https://github.com/deepseek-ai/cordis.git",
      "ref": "v0.2.1-rc.2",
      "path": ".dsh/clonedeps/repos/deepseek-ai__cordis",
      "packagePath": "packages/core",
      "reason": "Plugin runtime internals used by this profile"
    }
  ]
}
```

If one clone fails after others succeeded, still write state for the
successful ones so later inspection is not misleading.

Do not add `.dsh/clonedeps.json` to `.gitignore`. It is small, reviewable
project metadata that can be committed; only the cloned repository contents
under `.dsh/clonedeps/repos/` should be ignored.

## Step 7 — Register the Dependency Source in the Project Notes

After cloning, update the project's agent-facing notes (the repository's
`AGENTS.md`, or the project skill) so future agents know why the dependency
source exists and where to look. Keep each item to one short sentence.

## Cleanup

When the user asks to clean up, remove `.dsh/clonedeps/repos/` and the managed
clonedeps marker block from `.gitignore`. Ask before removing
`.dsh/clonedeps.json` or the notes section — they may be intentional project
metadata.
