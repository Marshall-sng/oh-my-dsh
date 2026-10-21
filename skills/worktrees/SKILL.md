---
name: worktrees
description: Manage Git worktrees as safe isolated coding lanes for complex, risky, or parallel work — planning, delegation, integration, and cleanup with explicit user confirmation for every Git mutation.
---

# Worktrees Orchestration Protocol

An opinionated protocol for using Git worktrees as isolated coding lanes. It
gives the orchestrator one consistent workflow for parallel work, risky
experiments, integration review, and cleanup.

## Core Contract

This is an **orchestrator-only** workflow. Other seats (`fixer`, `designer`,
`explorer`) can be assigned tasks inside a lane, but the orchestrator owns lane
planning, branch/path selection, file ownership, delegation, diff validation,
integration, and cleanup.

All lanes live under the default path:

```text
.dsh/worktrees/<slug>/
```

Do not create worktrees as sibling directories of the main checkout.

### State Tracking (`.dsh/worktrees.json`)

Use the optional local manifest `.dsh/worktrees.json` for structural tracking:

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-06-14T00:00:00.000Z",
  "lanes": [
    {
      "slug": "feature-auth-v2",
      "branch": "omods/feature-auth-v2",
      "path": ".dsh/worktrees/feature-auth-v2",
      "base": "main",
      "purpose": "refactor authentication flow to use OAuth2",
      "owner": "orchestrator",
      "status": "active",
      "areas": ["src/auth", "src/config"],
      "createdAt": "2026-06-14T12:00:00.000Z"
    }
  ]
}
```

Create it when initializing a lane if it does not exist, and keep it updated
as lanes are transitioned, integrated, or pruned. Treat it as local workflow
metadata by default; ask before making it a committed project convention.

---

## Safety Guidelines

### 1. Pre-Flight Checklist

- Confirm the current directory is inside a Git repository.
- Check the current branch, the base branch, and the dirty/uncommitted state.
- Inspect `git worktree list` to avoid path or branch conflicts.
- Ensure the branch name does not already exist locally or on the remote.
- Ensure `.dsh/worktrees/` is git-ignored before creating nested worktrees.

### 2. Mandatory User Confirmation

Get explicit user confirmation before executing:

- `git worktree add` or `git worktree remove`
- branch creation, deletion, or renaming
- merges, rebases, or cherry-picks
- `git prune` or `git worktree prune`
- destructive commands (`git reset --hard`, `git clean`, `git push --force`,
  removing a dirty worktree directory)

Never execute destructive commands, delete branches, remove dirty worktrees, or
clean uncommitted changes without confirmation for that exact operation.

### 3. Ignore File Setup

Before creating or cleaning lanes, inspect the existing `.gitignore`. Update
the managed block in place when present; otherwise append it. Add only the
missing exact lines below, never duplicate entries, never modify unrelated
rules.

`.gitignore`:

```gitignore
# BEGIN oh-my-dsh worktrees
.dsh/worktrees/
.dsh/worktrees.json
# END oh-my-dsh worktrees
```

Keep the lane readable to the agent's file tools if the project uses a
separate ignore file for that purpose.

---

## Workflow

### Phase 1 — Planning & Setup

1. Identify the task scope and pick a short `<slug>`.
2. Formulate a branch name — default `omods/<slug>` unless project convention
   says otherwise.
3. Validate repository safety and ask the user to confirm initializing the
   lane.
4. Ensure the managed ignore block is present.
5. Run:
   ```bash
   git worktree add -b <branch-name> .dsh/worktrees/<slug> <base-commit/branch>
   ```
6. Register the lane in `.dsh/worktrees.json`.

### Phase 2 — Execution & Delegation

1. Run every delegated lane with its working directory strictly inside
   `.dsh/worktrees/<slug>`.
2. Do not modify the main checkout for lane work — keep build, test, and edit
   operations inside the lane.
3. Track file or folder ownership per lane so parallel agents do not collide.
4. Commit inside the worktree only when the user asked for commits or approved
   local checkpoint commits.

### Phase 3 — Integration & Validation

Before merging or integrating:

1. Apply a proportionate final-state verification plan to the changed
   behavior and its important boundaries; run the checks the repository
   requires.
2. Produce and show a clear diff between the lane branch and the integration
   base.
3. Ask the user to confirm integration.
4. Perform the approved integration (merge or cherry-pick) from the main
   checkout or the approved integration checkout.

### Phase 4 — Cleanup & Pruning

1. Ensure the managed ignore block is still correct.
2. Ensure all changes are merged or archived.
3. Confirm the worktree has no uncommitted changes.
4. Request approval to remove the worktree.
5. Remove it:
   ```bash
   git worktree remove .dsh/worktrees/<slug>
   ```
6. Mark the lane `archived` in `.dsh/worktrees.json`, or remove the entry.

---

## When to Use vs. Not Use

**Use when:**

- doing risky or destructive refactoring that could break the active checkout
- running parallel tasks that need switching context without committing
  half-finished work
- running independent background agents on separate branches
- conducting exploratory spikes that may be discarded
- isolating third-party upgrades
- the user explicitly asked for worktrees

**Do NOT use when:**

- making simple single-file changes, doc updates, or minor bug fixes
- the repository is not fully initialized, or has submodule states that
  worktrees handle poorly
