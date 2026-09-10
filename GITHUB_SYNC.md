# MyDox and GitHub

Repository: [Peeyush-Nanhe/Drconnect](https://github.com/Peeyush-Nanhe/Drconnect). Local branch: `main`. Remote: `origin`. Authentication uses the configured Git credentials; no GitHub token is stored in this project.

Completed local changes are committed and pushed. Changes committed on GitHub are pulled into this folder, where Codex reads them. Git synchronizes commits, not each keystroke.

```powershell
npm run sync:status
npm run sync:pull
# After reviewing the intended local changes:
git add <reviewed-files>
git commit -m "Describe the completed change"
npm run sync:push
```

The push command runs `npm run check` first. Sync checks the expected repository and branch, refuses unfinished edits, and uses fast-forward updates. Divergent history needs review and a deliberate merge; it is never force-pushed.

A scheduled check in this task runs every hour while the computer and desktop app are running. It reports a sync or conflict and stays quiet when unchanged. It does not auto-commit work being edited. This schedule belongs to the original PC/task and is not installed by extracting the ZIP on another PC. [Official scheduled-task guidance](https://learn.chatgpt.com/docs/automations?surface=app).

GitHub synchronization updates source only. Supabase migrations, web hosting and APK releases need separate deployment steps. The live `.env`, secrets, dependencies and build outputs remain ignored. The root migration history contains excluded legacy demo SQL for provenance; use only the staging migration history for this database.
