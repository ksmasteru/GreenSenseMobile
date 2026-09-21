# docuMind Backend API

Every route exposed by the Spring Boot backend, with its request shape, return
type, and the JSON that actually reaches the client.

**Auth model.** `/api/auth/**` and `/actuator/**` are open; `/api/admin/**`
requires the `ADMIN` role; **everything else requires a valid bearer token**
(`Authorization: Bearer <accessToken>`). See `config/SecurityConfig.java`.

---

## `/api/auth` — AuthController

Public. Request bodies are plain `Map<String, String>`, so unknown keys are
accepted silently and missing keys arrive as `null`.

| Method | Path | Request body | Java return type |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ name, email, password }` | `ResponseEntity<?>` |
| POST | `/api/auth/register-admin` | `{ name, email, password, admin_key }` | `ResponseEntity<?>` |
| POST | `/api/auth/login` | `{ email, password }` | `ResponseEntity<?>` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | `ResponseEntity<?>` |
| POST | `/api/auth/logout` | `{ refreshToken }` | `ResponseEntity<?>` |

**`login` and `refresh` return `AuthResponse` on success:**

```json
{ "accessToken": "eyJ…", "refreshToken": "eyJ…", "type": "Bearer", "Role": "USER" }
```

**Status codes**

- `200` — success on all five routes
- `400` — `refresh` with a missing token; `register` / `register-admin` on a
  service failure, body `{ "error": "<message>" }`
- `401` — bad credentials on `login` (body `{ "error": "Invalid email or password" }`),
  invalid or expired token on `refresh` / `logout`, missing `admin_key` on
  `register-admin`
- `403` — wrong `admin_key` on `register-admin`

> `ResponseEntity<?>` means the success and error bodies are different shapes on
> the same route. Clients must branch on the status code before parsing.

---

## `/api/v1/ask` — AskController

Requires auth. The caller's identity comes from the token, never from the body.

| Method | Path | Request | Java return type |
| --- | --- | --- | --- |
| POST | `/api/v1/ask` | `AskRequest` (JSON) | `ResponseEntity<AiResponse>` |
| POST | `/api/v1/ask/image` | `image` (multipart file) | `ResponseEntity<AiResponse>` |

**`AskRequest`**

```json
{ "question": "How do I persist data?", "fileId": "abc-123" }
```

`fileId` is optional. When present, retrieval is scoped to that one document;
when absent or blank, it searches across everything the user has uploaded.

**`AiResponse`** — the same envelope for both routes:

```json
{
  "answer": [ { "key": "1.", "answer": "A) docker ps — …" } ],
  "answerCount": 1
}
```

- **`POST /api/v1/ask`** — one question, one answer. `answer` always holds a
  single element with `key` set to `"-"`, and `answerCount` is always `1`.
- **`POST /api/v1/ask/image`** — OCR extracts every question from the image, so
  `answer` holds one element per question. `key` is the question number as it
  appeared in the image, or `"-"` when the model's line carried no number.
  `answerCount` is the number of questions found.

A question the documents can't answer still returns `200`, with the string
`"Not answerable from the provided documents."` as its `answer`. That's a
successful response, not an error.

**Status codes**

- `200` — answered
- `404` — `NoChunksException`: retrieval found no chunks for this user
- `502` — `NoAiResultException`: the chat model returned no result
- `500` — anything else, including a failure reading the uploaded image

---

## `/api/v1/files` — DocumentController

Requires auth.

| Method | Path | Request | Java return type |
| --- | --- | --- | --- |
| POST | `/api/v1/files/upload` | `file` (multipart), `title` (optional) | `ResponseEntity<FileResponse>` |
| GET | `/api/v1/files/{name}` | path variable | `ResponseEntity<FileResponse>` |
| GET | `/api/v1/files/filter/{keyword}` | path variable | `ResponseEntity<FileResponse>` |
| GET | `/api/v1/files/user/{id}` | path variable | `ResponseEntity<FileResponse>` |
| GET | `/api/v1/files/id/{id}` | path variable | `ResponseEntity<ByteArrayResource>` |
| GET | `/api/v1/files/preview/id/{id}` | path variable | `ResponseEntity<ByteArrayResource>` |
| GET | `/api/v1/files/{fileId}/analysis` | path variable | `ResponseEntity<DataAnalysis>` |
| POST | `/api/v1/files/ask` | `Map<String, String>` | `ResponseEntity<Map<String, String>>` |
| DELETE | `/api/v1/files/id/{id}` | path variable | `ResponseEntity<Void>` |

**`FileResponse`** — used by all four listing/search routes, even the ones that
logically return a single file:

```json
{
  "files": [ { "id": "…", "name": "notes.pdf", "size": 20481, "userId": "user@example.com" } ],
  "filesCount": 1
}
```

**`ByteArrayResource`** — raw file bytes, not JSON. `/id/{id}` is a download and
`/preview/id/{id}` is an inline preview; they differ in `Content-Disposition`.

**`DataAnalysis`** — the stored analysis for a CSV/tabular upload:

```json
{
  "id": "…", "fileId": "…", "userId": "…",
  "analysisJson": "{…}", "textSummary": "…",
  "rowCount": 1200, "colCount": 8,
  "createdAt": "2026-08-29T10:00:00Z"
}
```

`analysisJson` is a JSON **string**, not a nested object — the client has to
parse it a second time.

**`POST /api/v1/files/ask`** returns `{ "response": "…" }`. This is an older RAG
entry point that predates `/api/v1/ask`; prefer the latter for new work.

**Status codes** — `200` on success, `204` on delete, `404` via
`FileNotFoundException`, `400` via `FileNotSupportedException` for a rejected
upload type.

---

## `/api/v1/users` — UserController

Requires auth. `DELETE` additionally requires `ADMIN` via `@PreAuthorize`.

| Method | Path | Request body | Java return type |
| --- | --- | --- | --- |
| GET | `/api/v1/users` | — | `UserResponseWrapper` (unwrapped) |
| GET | `/api/v1/users/{id}` | — | `ResponseEntity<UserResponseWrapper>` |
| POST | `/api/v1/users` | `UpdateUserRequest` | `ResponseEntity<UserResponseWrapper>` |
| PUT | `/api/v1/users/{id}` | `UpdateUserRequest` | `ResponseEntity<UserResponseWrapper>` |
| DELETE | `/api/v1/users/{id}` | — | `ResponseEntity<Void>` |

**`UserResponseWrapper`** — a list envelope, used even for single-user routes:

```json
{
  "users": [ { "name": "Hicham", "email": "…", "role": "USER" } ],
  "userCount": 1
}
```

`GET /api/v1/users` returns the record directly rather than wrapped in a
`ResponseEntity`. The JSON is identical; only the Java signature differs.

**Status codes** — `200` on read and update, `201` on create, `204` on delete,
`400` with field errors when `@Valid` rejects the body.

---

## Error responses

Every exception routed through `GlobalExceptionHandler` returns `ErrorFormat`:

```json
{
  "message": "no relevant document chunks for this question",
  "details": "uri=/api/v1/ask",
  "timestap": "2026-08-29T10:00:00",
  "errors": {}
}
```

`errors` is populated only by validation failures, mapping field name to message.

| Exception | Status |
| --- | --- |
| `UserNotFoundException` | 404 |
| `NoChunksException` | 404 |
| `NoAiResultException` | 502 |
| `IllegalArgumentException` | 400 |
| `MethodArgumentNotValidException` | 400 (with `errors` populated) |
| `FileNotSupportedException` | 400 |
| `SessionExpiredException` | 400 |
| any other `Exception` | 500 |

Note that the `/api/auth/**` routes do **not** produce this shape — they build
their error bodies inline as `String` or `Map`, so an auth failure looks nothing
like a failure anywhere else in the API.

---

## Known quirks

Documented as they are, not as they should be:

- **`timestap`** — `ErrorFormat`'s getter is `getTimestap()`, so Jackson emits
  the misspelled key. There is no `timestamp` field.
- **`Role`** — `AuthResponse` declares its component as `Role`, capitalised, so
  the JSON key is likely `"Role"` rather than `"role"`. Worth confirming against
  a live response before relying on it.
- **`SessionExpiredException` returns 400**, not 401. The handler carries a
  comment acknowledging this.
- **List envelopes for single items** — `FileResponse` and `UserResponseWrapper`
  wrap one-element lists on routes that can only ever return one thing.
- **`ResponseEntity<?>` across `/api/auth`** gives no compile-time guarantee
  about the body, and success and error shapes differ per route.
