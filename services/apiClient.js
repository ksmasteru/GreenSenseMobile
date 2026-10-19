// Minimal API client for the mobile app. Mirrors the web app's apiClient
// (my-react-app/src/apiClient.js) — same base-URL-from-env convention and
// the same endpoint paths — but stays fetch/XHR based since this project
// has no axios and no persisted-auth story yet.
//
// Set EXPO_PUBLIC_API_URL in a .env file at the project root (see
// .env.example), e.g.:
//   EXPO_PUBLIC_API_URL=http://localhost:8080
// EXPO_PUBLIC_ vars are inlined into the JS bundle at build time, so treat
// them as public config, never as a place for secrets.
//172.20.10.2


//. !! ALL THE AI HAS TO BE UPDATED WITH THE NEW CHANNGES TO AIRESPONSE CONTAINING CITATIONS
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://172.20.10.6:8080";
const REFRESH_API = "http://172.20.10.6:8080/api/auth/refresh"
if (__DEV__ && !API_URL) {
  console.warn(
    "[apiClient] EXPO_PUBLIC_API_URL is not set — requests will be sent to a relative path and likely fail. Add it to a .env file at the project root (see .env.example)."
  );
}

// Access token storage — kept in memory only, same reasoning as the web
// client: it disappears on app reload rather than sitting in AsyncStorage
// for anything to read. There's no login/refresh flow wired up on mobile
// yet (login.jsx still just hits a placeholder endpoint), so this is only
// the seam for when there is one — nothing calls setAccessToken today.
const REFRESH_TOKEN_KEY ='refreshToken';
let accessToken = null;

export async function searchDocument(search){
    let data = null;
    try{
      const response = await fetch(API_URL+`/api/v1/files/${search}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok)
      {
        console.error('error while fetching for files');
        return null; 
      }
      data = await response.json();
      console.log(data);
    }
    catch (error)
    {
      console.error(error);
      return null;
    }
    return data;
}

// AskController's ask() is declared `produces = TEXT_EVENT_STREAM_VALUE`
// (SSE), even though the mobile app isn't rendering it incrementally —
// so the body is "data: ...\n\n" frames, not JSON. This parses the whole
// thing in one pass the same way the web app's AskChat.jsx parses one
// live chunk: split on blank lines between frames, keep only "data:"
// lines per frame, strip the prefix, join multi-line frames with "\n",
// then concatenate frames directly (no separator — matches `text + chunk`
// in the web version).
function parseSseBody(raw) {
  return raw
    .split('\n\n')
    .map((frame) =>
      frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5))
        .join('\n')
    )
    .join('');
}

// Every AskController route (/ask, /ask/image, /ask/transcribe) answers with
// the same AiResponse envelope: { answer: [{ key, answer }], citations,
// answerCount }. `key` is the question number the model echoed back ("1.",
// "Q4)"), or "-" for a single unnumbered answer, which is a placeholder to
// skip. `citations` is a display string of source file names; routes that
// don't retrieve documents send "". Guard on the array itself rather than
// answerCount: a malformed response with the count missing would pass
// `answerCount != 0`. Accepts null so callers can pass a failed request
// straight through and get empty text back.
export function parseAiResponse(raw) {
  const answers = Array.isArray(raw?.answer) ? raw.answer : [];
  const askinteractioniD = raw?.askInteractionId;
  console.log("askInteractionId is : ", askinteractioniD);
  const text = answers
    .map(({ key, answer }) => (key && key !== '-' ? `${key} ${answer}` : answer))
    .join('\n');
    console.log("ai answer using rag ", text);
    if (text.trim() === 'null')
    {
      return {text : "I couldn't find an answer to this in your documents."}
    }
  // A backend build from before citations existed omits the field, and string
  // concatenation would then print a literal "undefined" under the answer.
  return { text};
}

// Matches AskController — POST /api/v1/ask (the class-level
// @RequestMapping is /api/v1/ask itself; ask() adds no extra path). This
// is a separate controller from DocumentController, not nested under
// /api/v1/files. `fileId` is optional in AskRequest — null means "search
// across all of the user's documents" per AskController's comment, which
// is what the general (non-file-scoped) ask tab wants.
export async function askQuestion(question, fileId = null) {
  try {
    const response = await fetch(API_URL + '/api/v1/ask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, fileId }),
    });
    if (!response.ok) {
      console.error('error while asking question');
      return null;
    }
    const raw = await response.json();
    return raw;
  } 
  catch (error) {
    console.error(error);
    return null;
  }
}

// 
export async function askImageQuestion(image)
{ 
  if (!image)
    return null;
  let data = null;
  const formData = new FormData();
  formData.append('image', {
    uri: image.uri,
    type:'image/jpeg',
    name:'upload.jpg'
  })
  try{
    const response = await fetch(API_URL + '/api/v1/ask/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData
    });
  if (!response.ok){
    console.error('error with the image question')
    return null;
  }
  const raw = await response.json();
  return raw;
  }
  catch (error)
  {
    console.error(error);
    return null;
  }
}

/**
 * Sends a recorded clip to the backend for transcription and returns the text.
 *
 * The backend — never the app — talks to the STT provider. EXPO_PUBLIC_* vars
 * are inlined into the JS bundle at build time, so a provider key shipped here
 * would be a published key. Same reason the app has no model credentials today.
 *
 * Without a language the provider auto-detects, which is what the Ask tab
 * wants: that keeps "add Darija later" a backend-only change with no edit on
 * this side. The forms screen passes 'fr', because a few seconds of dictated
 * comment is too little audio for detection to be reliable.
 *
 * `context` tells the transcriber what is being talked about — the forms
 * screen sends the checklist item, e.g. "Checklist du pont roulant. Point 3 :
 * Linguet de sécurité du crochet. Anomalie constatée :" — so its words come
 * out spelled right. Without it the backend uses its pump vocabulary.
 *
 * Matches POST /api/v1/ask/transcribe — multipart field `audio` plus optional
 * `language` and `context`, responding with the AiResponse envelope
 * (transcript as the single "-" answer, empty citations). Read it with
 * parseAiResponse().
 *
 * @param {string} uri file:// path produced by expo-audio's recorder
 * @param {string} [language] ISO-639-1 code such as 'fr'; omit to auto-detect
 * @param {string} [context] what the speaker is describing, in that language
 * @returns {Promise<object|null>} the raw AiResponse, or null on failure
 */
export async function transcribeAudio(uri, language, context) {
  if (!uri) return null;

  const formData = new FormData();
  // RN's FormData wants a {uri, name, type} descriptor for files, same as
  // uploadFile(). The recorder writes .m4a, which is an MPEG-4 container —
  // hence audio/mp4, the type servers actually match on.
  formData.append('audio', {
    uri,
    name: 'question.m4a',
    type: 'audio/mp4',
  });
  if (language) formData.append('language', language);
  if (context) formData.append('context', context);

  try {
    const response = await fetch(API_URL + '/api/v1/ask/transcribe', {
      method: 'POST',
      // No Content-Type on purpose: multipart needs a boundary only the
      // runtime can generate, and setting the header by hand strips it.
      // uploadFile() does the same; askImageQuestion() above does not, and
      // is worth revisiting.
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData,
    });
    if (!response.ok) {
      console.error('error while transcribing audio', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('transcribeAudio failed', error);
    return null;
  }
}


export async function login(email, password)
{
    let data = null;
    try {
      const response = await fetch(API_URL + '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body : JSON.stringify({email, password})
      });
      if (!response.ok)
      {
        console.error('couldnt log in');
        return null;
      }
      data = await response.json();
    } catch (error){
      console.error(error);
      return null;
    }
    return (data);
}

export async function saveRefreshToken(refreshToken)
{
  console.log('refresh token to save is : ', refreshToken);
  if (refreshToken)
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY,  refreshToken);
}
export async function getRefreshToken()
{
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function deleteRefreshToken()
{
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  if (accessToken)
    return accessToken
}

export async function refreshAccessToken()
{
  const refreshToken = await getRefreshToken();
  if (!refreshToken)
  {
    console.log('no refreshTokenFound');
    return null;
  }

  try {
    const response = await fetch(REFRESH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({refreshToken})
    });
    const data = await response.json();

    if (!response.ok) {
      await deleteRefreshToken();
      setAccessToken(null);
      return null;
    }

    setAccessToken(data.accessToken);
    // Backend rotates refresh tokens on use — persist the new one, or the
    // one in storage goes stale and the next refresh fails.
    if (data.refreshToken)
      await saveRefreshToken(data.refreshToken);

    // AuthResponse also carries the user's role (capital R: the Java record
    // field name), which decides the tabs they see
    return { accessToken: data.accessToken, role: data.Role };
  } catch (error) {
    console.log('refreshAccessToken failed', error);
    return null;
  }
}
/**
 * Uploads a file picked via expo-document-picker to the backend, reporting
 * progress the way the web app's axios `onUploadProgress` does. This uses
 * XMLHttpRequest instead of fetch because fetch has no upload-progress
 * event in React Native.
 *
 * @param {object} params
 * @param {{ uri: string, name: string, mimeType?: string }} params.file
 * @param {string} params.title
 * @param {(event: { loaded: number, total: number, lengthComputable: boolean }) => void} [params.onUploadProgress]
 * @returns {Promise<unknown>}
 */
export function uploadFile({ file, title, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/v1/files/upload`);

    // Deliberately NOT setting Content-Type — same reasoning as the web
    // client: FormData needs a multipart boundary that only the runtime can
    // generate, and setting the header manually strips it.
    if (accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onUploadProgress?.(event);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText ? safeParse(xhr.responseText) : null);
      } else {
        const error = new Error(`Upload failed with status ${xhr.status}`);
        error.response = { status: xhr.status };
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    const formData = new FormData();
    // React Native's FormData takes a {uri, name, type} descriptor for
    // files instead of a browser File/Blob.
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    });
    formData.append("title", title);

    xhr.send(formData);
  });
}

// Same technique as the web app's FileItem.jsx preview classification —
// fuzzy .includes()/.startsWith() matching against the real Content-Type
// header, not an exact-match table — so "application/pdf; charset=binary"
// still matches, the way an exact key lookup wouldn't. Extend as new file
// types show up.
function extensionForContentType(contentType) {
  if (!contentType) return '';
  if (contentType.includes('pdf')) return '.pdf';
  if (contentType.includes('epub')) return '.epub';
  if (contentType.includes('wordprocessingml')) return '.docx';
  if (contentType.includes('msword')) return '.doc';
  if (contentType.startsWith('text/') || contentType.includes('markdown')) return '.txt';
  return '';
}

/**
 * Downloads a file by id into the app's local sandbox (Paths.document),
 * the way uploadFile() sends one the other direction. This only gets the
 * bytes onto the device privately — handing it to the user still needs
 * expo-sharing on the caller's side.
 *
 * Matches DocumentController's GET /api/v1/files/id/{id}, which streams
 * the raw file bytes. Neither `fileName` (from the search results) nor
 * the server's Content-Disposition filename reliably carries the real
 * extension, so this reads the response's actual Content-Type header
 * first (same as the web app's preview code does) and picks the file's
 * final name from that, before ever writing it to disk.
 *
 * Uses expo/fetch instead of the global fetch used elsewhere in this file
 * because its Response has .bytes(), needed to hand raw bytes to
 * File.write() — File.downloadFileAsync doesn't expose a Response at all,
 * which is why reading response.headers off it doesn't work.
 *
 * @param {string} fileId
 * @param {string} fileName
 * @returns {Promise<import('expo-file-system').File|null>}
 */
export async function downloadDocument(fileId, fileName) {
  try {
    const response = await expoFetch(`${API_URL}/api/v1/files/id/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error('error while downloading file');
      return null;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const extension = extensionForContentType(contentType);
    const name = extension && !fileName.toLowerCase().endsWith(extension)
      ? `${fileName}${extension}`
      : fileName;

    const destination = new File(Paths.document, name);
    if (destination.exists) destination.delete(); // same overwrite intent as idempotent: true before
    destination.write(await response.bytes());

    return destination;
  } catch (error) {
    console.error('downloadDocument failed', error);
    return null;
  } 
}

// should return a fileReponse to be consistent.
export async function uploadScannedTextFile(text)
{
  try {
     const response = await fetch(API_URL + '/api/v1/files/scan',
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json'
        },
        body: 
            JSON.stringify({text}),
      }
     );
     // call structure when does this get called vs when exception is being thrown
     // and how do you handle this in front
    if (!response.ok)
    {
      console.error("error while uploading scanned file");
      return null;
    }
    const data = await response.json();
    return data;
  }
  catch (error)
  {
    console.log("an error occured while scanning document");
    return null;
  }
}

// Matches CheckListController — GET /api/v1/forms/options.
// Returns { FormItem: [{ id, title, type }], formsCount } (capital F in
// FormItem: it's the Java record field name), or null on failure.
export async function getFormOptions() {
  try {
    const response = await fetch(API_URL + '/api/v1/forms/options', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error('error while fetching form options', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('getFormOptions failed', error);
    return null;
  }
}

// Matches CheckListController — GET /api/v1/forms/inspectionForm/{id}.
// Returns { id, title, type, version, instructions, questions: [{ id,
// position, labelFr, labelAr, critical, answerType }] }, or null on failure.
export async function getInspectionForm(id) {
  try {
    const response = await fetch(API_URL + `/api/v1/forms/inspectionForm/${id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error('error while fetching inspection form', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('getInspectionForm failed', error);
    return null;
  }
}

// Matches SubmissionController — POST /api/v1/submissions.
// Unlike the other calls here, a refusal must reach the screen: the server
// re-checks the sheet and says why it rejects it ("comment required for
// question 4"). fetch doesn't throw on a 400 the way axios does on the web,
// so the body is read on both paths. Resolves to { result: { id, status } }
// on success, or { errors: [message, …] } on any failure.
export async function submitChecklist(submission) {
  try {
    const response = await fetch(API_URL + '/api/v1/submissions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });
    const data = safeParse(await response.text());
    if (response.ok) return { result: data };

    // ErrorFormat: { message, errors: { field: message } }. A 401/403 from
    // Spring Security has no such body, hence the fallback.
    console.error('submission refused', response.status, data);
    const fieldErrors = data?.errors ? Object.values(data.errors) : [];
    if (fieldErrors.length) return { errors: fieldErrors };
    return { errors: [data?.message || `Envoi refusé (${response.status}), réessayer.`] };
  } catch (error) {
    console.error('submitChecklist failed', error);
    return { errors: ['Envoi impossible : vérifier la connexion.'] };
  }
}

// Matches SubmissionController — GET /api/v1/submissions/{id}/preview.
// Returns { pages: [base64 PNG, …] }: the submission's PDF rendered on the server,
// one image per page, since the app has no PDF viewer. null on failure.
export async function getSubmissionPreview(submissionId) {
  try {
    const response = await fetch(API_URL + `/api/v1/submissions/${submissionId}/preview`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error('error while fetching the submission preview', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('getSubmissionPreview failed', error);
    return null;
  }
}

// Matches SubmissionController — GET /api/v1/submissions/{id}/pdf. Writes the PDF into
// the app's cache under the server's file name ("checklist-MP1-12-10-2026.pdf") and
// returns that File, ready to share or copy into a folder; null on failure. Same
// expo/fetch + response.bytes() route as downloadDocument().
export async function downloadSubmissionPdf(submissionId) {
  try {
    const response = await expoFetch(`${API_URL}/api/v1/submissions/${submissionId}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error('error while downloading the submission pdf', response.status);
      return null;
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? `checklist-${submissionId}.pdf`;

    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.write(await response.bytes());
    return file;
  } catch (error) {
    console.error('downloadSubmissionPdf failed', error);
    return null;
  }
}

// Matches TaskController — GET /api/v1/task/mine.
// Returns { tasks: [{ id, title, priority, status, equipmentId, location,
// dueDate, instructions }] }, or null on failure.
export async function getMyTasks() {
  try {
    const response = await fetch(API_URL + '/api/v1/task/mine', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error('error while fetching my tasks', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('getMyTasks failed', error);
    return null;
  }
}

// Matches TaskController — POST /api/v1/task/{id}/start (ASSIGNED -> STARTED).
// Resolves to true when the server accepted it. fetch doesn't throw on a
// 409 the way axios does on the web, so response.ok is what decides.
export async function startTask(taskId) {
  try {
    const response = await fetch(API_URL + `/api/v1/task/${taskId}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) console.error('start task refused', response.status);
    return response.ok;
  } catch (error) {
    console.error('startTask failed', error);
    return false;
  }
}

// Matches TaskController — POST /api/v1/task/{id}/decline with
// { reason: StatusReason, comment: string | null }. true when accepted.
export async function declineTask(taskId, reason, comment) {
  try {
    const response = await fetch(API_URL + `/api/v1/task/${taskId}/decline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, comment }),
    });
    if (!response.ok) console.error('decline task refused', response.status);
    return response.ok;
  } catch (error) {
    console.error('declineTask failed', error);
    return false;
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
