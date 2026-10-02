# Working on Soltech together

The shared repository is [karumph/soltech](https://github.com/karumph/soltech).
`karumph` owns it and already has access. The owner must invite `Sjayyy21` as a
collaborator, and `Sjayyy21` must accept the invitation to be able to push.
Being signed in or able to view a public repository does not grant write access.
See GitHub's [collaborator setup instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository).

Each developer should work in their own local clone. Do not both edit a single
shared or synchronized working directory. The existing SolTech folder is already
a Git repository; its owner can keep using it without cloning over it.

## Start a change

From your repository root, check for unfinished work first. Commit that work on
its own branch before switching branches.

```powershell
git status
git switch main
git pull --ff-only origin main
git switch -c jayden-ui
```

Use a new, descriptive branch name each time. For example, Jayden could use
`jayden-ui`, while the other developer uses `dev-scanner`. Coordinate when both
changes touch the same files. `main` should contain the reviewed version.

## Review, test, and share

The active editable app is `soltech-refined/dist`. Use the preview instructions in
the root README and check mobile and desktop layouts when changing UI.

```powershell
node --test soltech-refined/tests/*.test.mjs
git diff
git status --short
```

Stage only the files for your change. This example stages one stylesheet; replace
the path with the files you actually edited:

```powershell
git add soltech-refined/dist/soltech-identity.css
git diff --cached --stat
git diff --cached
git commit -m "Describe the change"
git push -u origin HEAD
```

Open the repository on GitHub and create a pull request from your branch into
`main`. Describe what changed and how you tested it. Have the other developer
review it before merging. Never force push `main`.

If Git reports an embedded repository, stop and inspect it before committing.
If a push is rejected, do not force it; first check access or pull the new changes.

## Keep your branch current

With a clean working tree on your feature branch:

```powershell
git fetch origin
git merge origin/main
```

If there are conflicts, review both versions with your co-developer, edit the
conflicted files to preserve the intended work, stage those files, and complete
the merge with `git commit`. Run the tests again before pushing. If you need to
back out of an unfinished merge, `git merge --abort` returns to the pre-merge state.

After the pull request is merged, begin the next change from updated `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c next-change
```

## What belongs in Git

Keep editable `dist/` files, tests, design assets, handoffs, and useful research.
Existing historical checkpoints are retained as reference material. Git now
records new work, so additional full-folder ZIP backups are usually unnecessary.
Inspect any archive you add: ignore rules cannot inspect secrets inside ZIP files.

Dependencies, caches, logs, environment files, private keys, and local hosting
identity are excluded by `.gitignore`. Example environment files may contain only
dummy placeholders. Ignore rules do not remove files that are already tracked;
review `git diff --cached` before every commit. Browser-local data and runtime API
keys are not synchronized by Git. Do not publish wallet secrets or recovery phrases.
