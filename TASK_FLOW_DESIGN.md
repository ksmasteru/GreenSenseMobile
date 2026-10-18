# Task flow design: accept → ask → report → submit

Design notes for the technician's task flow on mobile. The technician accepts an
assigned task, can use the Ask chat while working, then fills in the report and
submits it. Written 2026-10-18; the backend lives in `../documind/backend`.

## Starting point (backend, as of 2026-10-18)

- `GET /api/v1/task/mine` returns the technician's active tasks (`ASSIGNED`,
  `STARTED`, `BLOCKED`, `RETURNED`), including `instructions`.
- **Accept = `POST /api/v1/task/{id}/start`.** There is no separate accept
  status: accepting moves the task to `STARTED` and starts the work timer
  (`firstStartedAt` / `activeSince`).
- `POST /api/v1/task/{id}/decline` and `/block` take `{ reason, comment }`.
  Decline reasons: `ON_LEAVE`, `WRONG_TASK`, `NO_ISSUE_FOUND`. Block reasons:
  `MISSING_PART`, `NO_ACCESS`, `SAFETY_ISSUE`.
- The Ask chat (`POST /api/v1/ask`) is independent of tasks. Questions are
  stored in `ask_interaction`.
- A report is created with `POST /api/v1/submissions` (`templateId`,
  `equipment`, `inspectionDate`, …). **It has no link to a task**, and a task
  does not record which template it should use.
- `STARTED → SUBMITTED` exists in `TaskService.submitTask`, but the route is
  commented out in `TaskController`.

## Proposal: one screen per task, with three tabs

Accept opens the task screen, `app/task/[id].jsx`. It is a stack screen pushed
above `(tabs)`, so the app's main tab bar is hidden there. Everything for the
job lives on that one screen:

```
┌─────────────────────────────┐
│ ←  Fuite garniture 23AP08   │  header
│    2503523 · STARTED · 0:42 │  equipment, status, timer
├─────────────────────────────┤
│                             │
│   (content of active tab)   │
│                             │
│                             │
├─────────────────────────────┤
│ [ Block ]      [ Submit ▸ ] │  action bar (changes per tab)
├─────────────────────────────┤
│  📋 Details  💬 Ask  📝 Report│  bottom tab bar (thumb zone)
└─────────────────────────────┘
```

- **Tabs rather than a step-by-step wizard.** Technicians don't work in a
  straight line: they'll be halfway through the report, hit an unclear item, and
  need the chat. Tabs let them switch freely. A small check mark on Report shows
  when it's ready to submit.
- **Details:** the instructions, due date and equipment, plus Block (needs a
  reason). Later, this is also where a returned report shows the manager's
  comments.
- **Ask:** the chat from `app/(tabs)/ask.jsx`, extracted into a component and
  opened with the task's context. Keep all three tabs mounted and switch which
  one is visible, so the conversation survives switching tabs.
- **Report:** the form from `app/form/[id].jsx`, extracted into a component and
  pre-filled with the equipment and today's date from the task. Submit is only
  on this tab.

## Decisions to make

1. **Who picks the report template?** Recommended: the manager chooses it when
   creating the task (add `templateId` to `TaskModel` and `TaskCreationDto`).
   The technician then never has to pick a form on their phone. The alternative
   is a template selector on the Report tab, which is more error-prone.
2. **Submitting in one request.** Recommended: `POST /api/v1/task/{id}/submit`
   creates the submission and moves the task to `SUBMITTED` in a single
   transaction. Two separate calls can leave a report saved while the task still
   says `STARTED`.
3. **Link the chat to the task.** Add an optional `taskId` to the ask request
   and store it on `ask_interaction`. The manager reviewing the report can then
   see what the technician asked, which helps judge the quality of the report
   and of the RAG answers.
4. **Should the chat be required?** Recommended: optional. Forcing a question
   just adds a step.

## Phone-specific points

- **Losing the draft.** The OS can kill the app during a phone call or after a
  switch to another app. Autosave the report draft on the device, keyed by task
  id. `@react-native-async-storage/async-storage` isn't installed yet;
  `expo-file-system`, which is installed, also works. A server-side draft would
  be better still.
- **Keyboard and safe areas.** Wrap the chat and form in `SafeAreaView` (from
  `react-native-safe-area-context`) and `KeyboardAvoidingView`, so the chat
  input and the action bar stay above the keyboard and the home indicator.
- **Inputs.** Make tap targets at least 44pt. Put voice input
  (`hooks/use-voice-input.js`) and photos (`expo-image-picker` / `expo-camera`,
  sent to `/api/v1/ask/image`) on both the chat and the report's comment fields.
- **Accept starts the timer.** Since Accept calls `/start`, the timer begins as
  soon as the technician accepts. Showing it in the header makes that clear to
  them.

## Build order

1. Frontend only: `app/task/[id].jsx` with the three tabs, using the existing
   ask and form components, and Accept navigates to it.
2. Backend: `templateId` on tasks, and the single submit endpoint.
3. `taskId` on chat questions, and draft autosave.

Open question: decision 1 (who picks the template) decides whether the Report
tab needs a form selector at all.
