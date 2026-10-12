# Next step: capturing technician feedback

Implementation plan for §5 of *WS3 — Chatbot GreenSense 4.0* (the interaction
loop), which is also the fourth knowledge layer of §3: internal, capitalised
knowledge.

## 1. Today the loop is open

```
 technician ──question──► phone ──► /api/v1/ask
                                        │
                                        ├─ normalise (OTW → AHLSTAR)
                                        ├─ embed + retrieve 12 chunks
                                        └─ LLM ──► answer + sources
                                                     │
                                                     ▼
                                             shown on screen
                                                     │
                                                     ✗ gone
```

Everything the technician knows about that answer — right, wrong, half right,
missing the real cause — evaporates when the app closes. Ingested documents can
be re-ingested at any time. This cannot: it exists only at the moment someone
reads the answer.

That is the argument for building it before WS2 sensor data or richer
citations.

## 2. What closing the loop means

```
 question ──► retrieve ──► answer ──► technician reacts ──► stored
                  ▲                    ✔ correct                │
                  │                    ✎ "no, it's the seal"    │
                  └──────── later: becomes retrievable ─────────┘
```

Two phases, deliberately separate:

| Phase | What it does | When |
|---|---|---|
| **A. Capture** | write a row per question plus the technician's verdict | now, small |
| **B. Reuse** | approved corrections become chunks the RAG can retrieve | later, once rows exist |

Phase B is worthless without A, and A is cheap. Build A first and let rows
accumulate while other work continues.

## 3. The anatomy of one row

```
 ask_interaction
 ├─ id                  ← returned to the phone so feedback can attach to it
 ├─ user_id, created_at
 ├─ question_raw        "what is the pump OTW"     ← as spoken or typed
 ├─ question_normalised "what is the pump AHLSTAR" ← the replaced question
 ├─ pump                "OTW"                      ← matchedPumps, or null
 ├─ chunk_ids + file_names   ← what retrieval actually used
 ├─ answer              full text including the sources line
 ├─ prompt_version      "v3"
 ├─ verdict             pending | confirmed | corrected | rejected
 └─ correction          the technician's own words
```

Two fields that are easy to skip and painful to add later:

- **`chunk_ids` + `file_names`.** Without them, a "wrong" verdict can't
  distinguish retrieval fetching the wrong pages from the model misreading the
  right ones. Those need entirely different fixes.
- **`prompt_version`.** The prompt changes often. Feedback from before a change
  says nothing about current behaviour, and mixing the two makes the numbers
  meaningless:

```
 prompt v2 ████████░░░░░░░░   12 confirmed, 9 rejected
 prompt v3 ░░░░░░░░████████    8 confirmed, 1 rejected   ← only readable if rows are stamped
```

A constant in `AskService`, bumped by hand when the prompt is edited, is
enough.

## 4. The order to build it

**Step 1 — the backend writes the row.** At the end of
`answerPhovaWithAiRag`, after `getAnswer` returns, insert the row and return
its id alongside the answer. Verdict starts as `pending`.

**Step 2 — the envelope carries the id.** `AiResponse` gains an
`interactionId`, so `parseAiResponse` in `services/apiClient.js` picks it up
and `sendQuestion` keeps it on the message object in `app/(tabs)/ask.jsx`.

Do this at the same time as the source-file renaming. Both change what the app
receives, and one rebuild-and-retest cycle beats two.

**Step 3 — two icons under each answer bubble.** A check and a pencil. The
check posts `confirmed`. The pencil opens the input with the answer in it so
the technician can write what was actually true, and posts `corrected` with
that text.

```
 ┌─────────────────────────────────────────┐
 │ The OTW pump is rated …                 │
 │ sources : OTW_manual.pdf                │
 │                                  ✔   ✎  │  ← the entire UI for step 3
 └─────────────────────────────────────────┘
```

**Step 4 — `POST /api/v1/feedback`**, taking
`{ interactionId, verdict, correction }` and updating the row. Nothing else
touches it yet.

That is the whole capture phase. Everything afterwards depends on having the
rows.

## 5. What phase B looks like, so step 1 doesn't box you in

```
 corrected row ──► expert reviews it ──► approved ──► embedded as a chunk
                        │                                    │
                        └─ rejected → stays as history only  └─ retrieved like a manual page,
                                                                labelled "intervention, 12 Mar 2026"
```

The review gate is not optional: §6 of the spec requires human validation
before machine-learned rules are applied, and without it one mistaken
correction becomes a fact the chatbot repeats forever. An `approved_at` column
now saves a migration later.

## One practical warning

Re-uploading the renamed sources creates new file rows and new chunk ids.
Anything captured before the re-upload points at ids that no longer exist. So
either re-upload first, or store the file **name** beside the id — which is
needed anyway to show which document an answer was built from after a
re-ingest.
