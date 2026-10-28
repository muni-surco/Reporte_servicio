/**
 * Firebase.gs — Firestore REST API integration for Google Apps Script.
 * Uses service account to authenticate via OAuth2 JWT bearer token.
 * 
 * Setup: Run setupFirebase(JSON.stringify(serviceAccountKey)) from GAS editor.
 *        Service account key from Firebase Console > Project Settings > Service Accounts.
 */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects';

// --- Firebase usage counters (reset per script execution) ---
var _fbReads = 0;
var _fbWrites = 0;

function _fbLogUsage() {
  let origen = '?';
  let modo = '?';
  try {
    if (typeof _rtdbAuth === 'function') {
      const a = _rtdbAuth();
      origen = a.origen;
      modo = a.useSecret ? 'secret' : 'oauth';
    }
  } catch (e) { /* ignore */ }
  console.log('[FIREBASE_USAGE] reads=' + _fbReads + ' writes=' + _fbWrites + ' auth=' + origen + ' modo=' + modo);
}

function getFirebaseUsage() {
  return { reads: _fbReads, writes: _fbWrites };
}

// --- Cortacircuitos de cuota RTDB -----------------------------------------
// Cuando Google agota la cuota ("premium urlfetch") no sirve reintentar en
// cada lectura/escritura: se marca en cache 5 minutos y todas las operaciones
// RTDB fallan rapido (lecturas devuelven null, escrituras lanzan error) para
// que la app use hojas/cache en vez de quedarse colgada.
const RTDB_QUOTA_KEY = 'RTDB_QUOTA_DOWN';
const RTDB_QUOTA_TTL = 300;

function _rtdbQuotaDown() {
  try { return !!CacheService.getScriptCache().get(RTDB_QUOTA_KEY); } catch (e) { return false; }
}

function _rtdbMarkQuotaDown(motivo) {
  try {
    const modo = _rtdbAuth().useSecret ? 'secret (?auth=)' : 'oauth (Bearer)';
    CacheService.getScriptCache().put(RTDB_QUOTA_KEY, '1', RTDB_QUOTA_TTL);
    console.warn('[RTDB] cuota agotada (' + (motivo || '') + ') usando ' + modo + '. Sin llamadas RTDB por ' + RTDB_QUOTA_TTL + 's.');
  } catch (e) { /* ignore */ }
}

function _isQuotaExceeded(err) {
  const msg = String((err && err.message) || err || '');
  return /premium urlfetch|too many times|quota|QUOTA_EXCEEDED/i.test(msg);
}

/**
 * Store service account JSON in script properties (run once from editor).
 * 
 * Instructions:
 * 1. Open the spreadsheet linked to this script (MOBILE_DATA spreadsheet)
 * 2. Go to any empty cell far away (ej: Z1 on DATA sheet)
 * 3. Paste the ENTIRE service account JSON into that cell 
 * 4. Note the sheet name and cell address
 * 5. Run: setupFirebase("DATA", "Z1") from GAS editor
 * 
 * Example: setupFirebase("DATA", "Z1")
 */
function setupFirebase(sheetName, cellA1) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" not found');

  const range = sheet.getRange(cellA1);
  const jsonString = range.getValue();
  
  if (!jsonString || jsonString.trim() === '') {
    throw new Error('Cell ' + sheetName + '!' + cellA1 + ' is empty. Paste the service account JSON there first.');
  }

  const trimmed = jsonString.trim();
  JSON.parse(trimmed); // validate before saving

  PropertiesService.getScriptProperties().setProperty('FIREBASE_SERVICE_ACCOUNT', trimmed);
  range.clear(); // clear it so credentials aren't left in the sheet

  console.log('Firebase service account stored successfully.');
}

/**
 * Also accepts the JSON as a direct argument (for programmatic use via doPost).
 */
function setupFirebaseFromString(jsonString) {
  PropertiesService.getScriptProperties().setProperty('FIREBASE_SERVICE_ACCOUNT', jsonString);
}

/**
 * Get parsed service account config.
 */
function _getFirebaseConfig() {
  const json = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
  if (!json) {
    throw new Error('Firebase no configurado. Ejecuta setupFirebase() con la clave de cuenta de servicio.');
  }
  return JSON.parse(json);
}

/**
 * Get or generate cached OAuth2 access token for Firebase REST API.
 * Token expires in 1 hour; cached for 55 min.
 */
function _getFirebaseToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('FB_TOKEN');
  if (cached) return cached;

  const config = _getFirebaseConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: config.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64 = function (obj) { return Utilities.base64EncodeWebSafe(JSON.stringify(obj)); };
  const toSign = b64(header) + '.' + b64(claim);
  const signature = Utilities.computeRsaSha256Signature(toSign, config.private_key);
  const jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signature);

  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    payload: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt),
    muteHttpExceptions: true
  });

  const body = JSON.parse(res.getContentText());
  if (body.error) {
    throw new Error('Firebase auth: ' + body.error + ' — ' + (body.error_description || ''));
  }

  cache.put('FB_TOKEN', body.access_token, 3300);
  return body.access_token;
}

/**
 * Helper: encode a resource path segment for Firestore REST API.
 */
function _fsEncode(str) {
  return encodeURIComponent(String(str));
}

/**
 * Helper: convert a JS value to Firestore REST API Value.
 */
function _fbVal(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return { timestampValue: val.toISOString() };
  }
  return { stringValue: String(val) };
}

/**
 * Helper: convert JS object to Firestore fields map.
 */
function _toFields(obj) {
  const fields = {};
  for (const key of Object.keys(obj)) {
    fields[key] = _fbVal(obj[key]);
  }
  return fields;
}

/**
 * Helper: convert Firestore fields map back to JS object.
 * All values returned as strings (matching the app's data model).
 */
function _fromFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) obj[key] = val.stringValue;
    else if ('integerValue' in val) obj[key] = val.integerValue;
    else if ('doubleValue' in val) obj[key] = String(val.doubleValue);
    else if ('booleanValue' in val) obj[key] = val.booleanValue;
    else if ('timestampValue' in val) obj[key] = val.timestampValue;
    else if ('nullValue' in val) obj[key] = null;
    else obj[key] = '';
  }
  return obj;
}

/**
 * Fetch a single Firestore document.
 * @param {string} collection — collection name
 * @param {string} docId — document ID
 * @returns {object|null} plain JS object, or null if not found
 */
function fbGet(collection, docId) {
  const token = _getFirebaseToken();
  const config = _getFirebaseConfig();
  const url = FIRESTORE_BASE + '/' + _fsEncode(config.project_id)
    + '/databases/(default)/documents/' + _fsEncode(collection) + '/' + _fsEncode(docId);

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });

  _fbReads++;
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) {
    throw new Error('fbGet error: ' + res.getContentText());
  }
  return _fromFields(JSON.parse(res.getContentText()).fields);
}

/**
 * Upsert a document (create or merge).
 * @param {string} collection
 * @param {string} docId
 * @param {object} data — plain JS object
 */
function fbSet(collection, docId, data) {
  const token = _getFirebaseToken();
  const config = _getFirebaseConfig();
  const url = FIRESTORE_BASE + '/' + _fsEncode(config.project_id)
    + '/databases/(default)/documents/' + _fsEncode(collection) + '/' + _fsEncode(docId);

  const body = { fields: _toFields(data) };

  const res = UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  _fbWrites++;
  if (res.getResponseCode() !== 200) {
    throw new Error('fbSet error: ' + res.getContentText());
  }
  return _fromFields(JSON.parse(res.getContentText()).fields);
}

/**
 * Batch upsert multiple documents in parallel using UrlFetchApp.fetchAll.
 * @param {Array<{collection:string, docId:string, data:object}>} items
 */
function fbSetAll(items) {
  if (!items || items.length === 0) return [];

  const token = _getFirebaseToken();
  const config = _getFirebaseConfig();
  const baseUrl = FIRESTORE_BASE + '/' + _fsEncode(config.project_id) + '/databases/(default)/documents';
  const CHUNK = 100;
  const results = [];

  for (let start = 0; start < items.length; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK);
    const requests = chunk.map(item => ({
      url: baseUrl + '/' + _fsEncode(item.collection) + '/' + _fsEncode(item.docId),
      method: 'patch',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ fields: _toFields(item.data) }),
      muteHttpExceptions: true
    }));

    const responses = UrlFetchApp.fetchAll(requests);
    for (let i = 0; i < responses.length; i++) {
      _fbWrites++;
      if (responses[i].getResponseCode() !== 200) {
        throw new Error('fbSetAll error en ' + chunk[i].docId + ': ' + responses[i].getContentText());
      }
      results.push(_fromFields(JSON.parse(responses[i].getContentText()).fields));
    }
  }

  return results;
}

/**
 * Run a Firestore structured query with automatic pagination.
 * If no limit is given, fetches ALL matching documents (paginated internally).
 * @param {string} collection
 * @param {Array<{field:string, value:string, op?:string}>} filters
 *   op: 'EQUAL' (default), 'LESS_THAN', 'GREATER_THAN', 'ARRAY_CONTAINS', etc.
 * @param {string|null} orderByField — field to sort
 * @param {number|null} limit — max results (null = all)
 * @param {string|null} orderDirection — 'DESCENDING' (default) or 'ASCENDING'
 * @returns {Array<object>} matching documents
 */
function fbQuery(collection, filters, orderByField, limit, orderDirection) {
  const PAGE_SIZE = 300;
  let allDocuments = [];
  let cursor = null;
  const config = _getFirebaseConfig();
  const baseUrl = FIRESTORE_BASE + '/' + _fsEncode(config.project_id)
    + '/databases/(default)/documents:runQuery';

  while (true) {
    const token = _getFirebaseToken();
    const query = { structuredQuery: { from: [{ collectionId: collection }] } };

    if (filters && filters.length > 0) {
      if (filters.length === 1) {
        query.structuredQuery.where = {
          fieldFilter: {
            field: { fieldPath: filters[0].field },
            op: filters[0].op || 'EQUAL',
            value: _fbVal(filters[0].value)
          }
        };
      } else {
        query.structuredQuery.where = {
          compositeFilter: {
            op: 'AND',
            filters: filters.map(f => ({
              fieldFilter: {
                field: { fieldPath: f.field },
                op: f.op || 'EQUAL',
                value: _fbVal(f.value)
              }
            }))
          }
        };
      }
    }

    if (orderByField) {
      query.structuredQuery.orderBy = [{
        field: { fieldPath: orderByField },
        direction: orderDirection || 'DESCENDING'
      }];
    }

    const remaining = limit ? limit - allDocuments.length : PAGE_SIZE;
    query.structuredQuery.limit = Math.min(remaining, PAGE_SIZE);

    if (cursor) {
      query.structuredQuery.startAfter = cursor;
    }

    const res = UrlFetchApp.fetch(baseUrl, {
      method: 'post',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(query),
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      throw new Error('fbQuery error: ' + res.getContentText());
    }

    const raw = JSON.parse(res.getContentText());
    const docs = raw.filter(r => r.document).map(r => {
      const obj = _fromFields(r.document.fields);
      obj._id = r.document.name.split('/').pop();
      return obj;
    });
    _fbReads += docs.length;
    allDocuments = allDocuments.concat(docs);

    // Check for cursor to continue pagination
    const entry = raw.find(r => r.cursor);
    cursor = entry ? entry.cursor : null;

    if (!cursor || (limit && allDocuments.length >= limit)) break;
  }

  return allDocuments;
}

/**
 * Delete a document (used by migration cleanup if needed).
 */
function fbDelete(collection, docId) {
  const token = _getFirebaseToken();
  const config = _getFirebaseConfig();
  const url = FIRESTORE_BASE + '/' + _fsEncode(config.project_id)
    + '/databases/(default)/documents/' + _fsEncode(collection) + '/' + _fsEncode(docId);

  const res = UrlFetchApp.fetch(url, {
    method: 'delete',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200 && res.getResponseCode() !== 404) {
    throw new Error('fbDelete error: ' + res.getContentText());
  }
  return true;
}

// ========================================================================
// Realtime Database (RTDB) — no per-document read limits
// ========================================================================

const RTDB_BASE = 'https://registroasistenciamss-default-rtdb.firebaseio.com';
const RTDB_SECRET_PROP = 'RTDB_SECRET';

// Memo por ejecucion: evita leer PropertiesService en cada llamada.
var _rtdbSecretMemo = null;

function _sanitizeSecret(value) {
  let s = String(value == null ? '' : value).trim();
  // Copiar/pegar desde Firebase puede arrastrar comillas o saltos de linea.
  if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
      (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
    s = s.substring(1, s.length - 1).trim();
  }
  return s.replace(/\s+/g, '');
}

function _readSecretFrom(store) {
  try {
    const props = store.getProperties() || {};
    const exact = _sanitizeSecret(props[RTDB_SECRET_PROP]);
    if (exact) return exact;
    // Tolerar variantes de nombre: "rtdb_secret", " RTDB_SECRET ", etc.
    const target = RTDB_SECRET_PROP.toUpperCase();
    const aliases = {
      RTDB_SECRET: true, RTDBSECRET: true, SETUPRTDBSECRET: true,
      FIREBASE_RTDB_SECRET: true, FIREBASERTDBSECRET: true, DATABASE_SECRET: true
    };
    for (const k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      const norm = String(k).trim().toUpperCase().replace(/\s+/g, '_');
      if (norm === target || aliases[norm]) {
        const v = _sanitizeSecret(props[k]);
        if (v) return v;
      }
    }
    return '';
  } catch (e) { return ''; }
}

/**
 * Optional RTDB database secret (legacy). If set, it is used as `?auth=`
 * instead of an OAuth Bearer token. This avoids the authenticated
 * "premium urlfetch" token exchange.
 *
 * Se busca en las tres ubicaciones posibles de Apps Script porque es facil
 * guardarla en "Propiedades del usuario" en lugar de "Propiedades del script".
 */
function _getRtdbSecretDetalle() {
  if (_rtdbSecretMemo) return _rtdbSecretMemo;

  const script = _readSecretFrom(PropertiesService.getScriptProperties());
  if (script) return (_rtdbSecretMemo = { secret: script, origen: 'script' });

  const user = _readSecretFrom(PropertiesService.getUserProperties());
  if (user) return (_rtdbSecretMemo = { secret: user, origen: 'usuario' });

  let doc = '';
  try {
    doc = _readSecretFrom(PropertiesService.getDocumentProperties());
  } catch (e) { doc = ''; }
  if (doc) return (_rtdbSecretMemo = { secret: doc, origen: 'documento' });

  return (_rtdbSecretMemo = { secret: '', origen: 'ninguno' });
}

function _getRtdbSecret() {
  return _getRtdbSecretDetalle().secret;
}

/**
 * Devuelve si conviene usar el secret. Si ya fue rechazado (401/403) se evita
 * por 10 minutos para no romper lecturas/escrituras.
 */
function _rtdbAuth() {
  const det = _getRtdbSecretDetalle();
  let rejected = false;
  try { rejected = !!CacheService.getScriptCache().get('RTDB_SECRET_REJECTED'); } catch (e) { rejected = false; }
  const useSecret = !!det.secret && !rejected;
  return { useSecret: useSecret, secret: useSecret ? det.secret : '', origen: det.origen };
}

function _rtdbMarkSecretRejected(code) {
  try { CacheService.getScriptCache().put('RTDB_SECRET_REJECTED', '1', 600); } catch (e) { /* ignore */ }
  console.warn('[RTDB] secret rechazado (HTTP ' + code + '): se usara OAuth por 10 min. Revisa el secret en Firebase.');
}

/**
 * Version del backend + modo de autenticacion RTDB que se esta usando.
 * Se devuelve al frontend para confirmar, sin abrir logs, que la version
 * desplegada es la nueva y si esta entrando el secret.
 */
const BACKEND_CODIGO = 'FASE-A-2026-10-28c';

function _authInfo() {
  try {
    const a = _rtdbAuth();
    return { modo: a.useSecret ? 'secret' : 'oauth', origen: a.origen, codigo: BACKEND_CODIGO };
  } catch (e) {
    return { modo: '?', origen: '?', codigo: BACKEND_CODIGO };
  }
}

/**
 * Guarda el secret en las propiedades del script y verifica que se lea bien.
 * Ejecutar desde el editor: configurarRtdbSecret('PEGA_EL_SECRET')
 */
function configurarRtdbSecret(secret) {
  const limpio = _sanitizeSecret(secret);
  if (!limpio) throw new Error('Secret vacio: pasa el valor de Firebase > Realtime Database > Secretos.');
  PropertiesService.getScriptProperties().setProperty(RTDB_SECRET_PROP, limpio);
  _rtdbSecretMemo = null;
  const det = _getRtdbSecretDetalle();
  console.log('[configurarRtdbSecret] origen=' + det.origen + ' largo=' + det.secret.length);
  return { ok: !!det.secret, origen: det.origen, largo: det.secret.length };
}

// Compatibilidad con el nombre anterior.
function setupRtdbSecret(secret) {
  return configurarRtdbSecret(secret);
}

/**
 * Si el secret quedo guardado como propiedad de USUARIO o de DOCUMENTO,
 * lo copia a propiedades del script (donde lo busca la app).
 */
function migrarRtdbSecret() {
  const det = _getRtdbSecretDetalle();
  if (det.origen === 'script') {
    console.log('[migrarRtdbSecret] Ya esta en propiedades del script (nada que hacer).');
    return { ok: true, origen: 'script' };
  }
  if (!det.secret) {
    console.log('[migrarRtdbSecret] No hay RTDB_SECRET en ninguna ubicacion. Usa configurarRtdbSecret("...").');
    return { ok: false, origen: 'ninguno' };
  }
  PropertiesService.getScriptProperties().setProperty(RTDB_SECRET_PROP, det.secret);
  _rtdbSecretMemo = { secret: det.secret, origen: 'script' };
  console.log('[migrarRtdbSecret] Copiado desde propiedades de ' + det.origen + ' a propiedades del script.');
  return { ok: true, origen: 'script' };
}

function _propKeys(store) {
  try { return Object.keys(store.getProperties() || {}); } catch (e) { return ['(error: ' + ((e && e.message) || e) + ')']; }
}

/**
 * Quita la marca de "cuota agotada" (normalmente expira sola en 5 minutos).
 * Ejecutar desde el editor si se quiere volver a probar RTDB de inmediato.
 */
function resetRtdbQuotaFlag() {
  CacheService.getScriptCache().remove(RTDB_QUOTA_KEY);
  console.log('Marca de cuota RTDB eliminada.');
}

/**
 * Diagnostico rapido: ejecutar desde el editor de GAS y revisar "Ejecuciones".
 * Prueba el secret y, si falla, el modo OAuth, e indica cual usara la app.
 */
function diagnosticoRtdb() {
  const det = _getRtdbSecretDetalle();
  const auth = _rtdbAuth();
  const info = {
    codigo: 'FASE-A-2026-10-28c',
    origenSecret: det.origen,
    tieneSecret: !!det.secret,
    largoSecret: det.secret.length,
    huellaSecret: det.secret ? (det.secret.substring(0, 4) + '...' + det.secret.substring(det.secret.length - 4)) : '',
    base: RTDB_BASE,
    cuotaMarcada: _rtdbQuotaDown(),
    modoEfectivo: auth.useSecret ? 'secret (?auth=)' : 'oauth (Bearer)',
    clavesScript: _propKeys(PropertiesService.getScriptProperties()),
    clavesUsuario: _propKeys(PropertiesService.getUserProperties()),
    clavesDocumento: (function () { try { return _propKeys(PropertiesService.getDocumentProperties()); } catch (e) { return ['(no aplica: script independiente)']; } })()
  };

  const probar = function (usarSecret) {
    const t0 = Date.now();
    const out = { modo: usarSecret ? 'secret (?auth=)' : 'oauth (Bearer)' };
    try {
      const url = RTDB_BASE + '/_meta/units.json?shallow=true' + (usarSecret ? '&auth=' + encodeURIComponent(det.secret) : '');
      const options = { method: 'get', muteHttpExceptions: true };
      if (!usarSecret) options.headers = { Authorization: 'Bearer ' + _getRTDBToken() };
      const res = UrlFetchApp.fetch(url, options);
      out.http = res.getResponseCode();
      out.ms = Date.now() - t0;
      out.respuesta = String(res.getContentText() || '').substring(0, 120);
    } catch (e) {
      out.ms = Date.now() - t0;
      out.error = String((e && e.message) || e);
      if (_isQuotaExceeded(e)) out.cuotaAgotada = true;
    }
    return out;
  };

  if (det.secret) {
    const conSecret = probar(true);
    info.http = conSecret.http;
    info.modo = conSecret.modo;
    info.ms = conSecret.ms;
    info.respuesta = conSecret.respuesta;
    if (conSecret.error) info.error = conSecret.error;
    if (conSecret.cuotaAgotada) info.cuotaAgotada = true;
    if (conSecret.http === 401 || conSecret.http === 403) {
      info.secretRechazado = true;
      info.oauth = probar(false);
    }
  } else {
    info.modo = 'oauth (Bearer)';
    info.oauth = probar(false);
    info.http = info.oauth.http;
    info.ms = info.oauth.ms;
    if (info.oauth.error) info.error = info.oauth.error;
    if (info.oauth.cuotaAgotada) info.cuotaAgotada = true;
    info.instruccion = 'Falta RTDB_SECRET. En el editor ejecuta configurarRtdbSecret("<secret de Firebase>") ' +
      'o agrega la propiedad RTDB_SECRET en Configuracion del proyecto > Propiedades del script.';
  }

  console.log('[diagnosticoRtdb] ' + JSON.stringify(info));
  return info;
}

/**
 * OAuth2 token for RTDB (cached 55 min). Different scope from Firestore.
 */
function _getRTDBToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('RTDB_TOKEN');
  if (cached) return cached;

  const config = _getFirebaseConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: config.client_email,
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64 = function (obj) { return Utilities.base64EncodeWebSafe(JSON.stringify(obj)); };
  const toSign = b64(header) + '.' + b64(claim);
  const signature = Utilities.computeRsaSha256Signature(toSign, config.private_key);
  const jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signature);

  let res;
  try {
    res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt),
      muteHttpExceptions: true
    });
  } catch (eToken) {
    if (_isQuotaExceeded(eToken)) {
      _rtdbMarkQuotaDown('token OAuth');
      throw new Error('RTDB auth: cuota premium urlfetch agotada. Configura RTDB_SECRET para evitarlo.');
    }
    throw eToken;
  }

  const body = JSON.parse(res.getContentText());
  if (body.error) {
    throw new Error('RTDB auth: ' + body.error + ' — ' + (body.error_description || ''));
  }

  cache.put('RTDB_TOKEN', body.access_token, 3300);
  return body.access_token;
}

/**
 * GET data from RTDB path. Returns null if not found.
 * @param {string} path — e.g. "units/2026-06-02_TARDE"
 * @returns {object|null}
 */
function rtdbGet(path) {
  if (_rtdbQuotaDown()) return null;
  try {
    const auth = _rtdbAuth();
    const url = RTDB_BASE + '/' + path + '.json' + (auth.useSecret ? '?auth=' + encodeURIComponent(auth.secret) : '');
    const options = { method: 'get', muteHttpExceptions: true };
    if (!auth.useSecret) {
      const token = _getRTDBToken();
      options.headers = { Authorization: 'Bearer ' + token };
    }
    let res = UrlFetchApp.fetch(url, options);
    if (auth.useSecret && (res.getResponseCode() === 401 || res.getResponseCode() === 403)) {
      // El secret no sirve: se reintenta con OAuth para no dejar la app sin datos.
      _rtdbMarkSecretRejected(res.getResponseCode());
      const token = _getRTDBToken();
      res = UrlFetchApp.fetch(RTDB_BASE + '/' + path + '.json', {
        method: 'get',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + token }
      });
    }

    _fbReads++;
    if (res.getResponseCode() === 404 || !res.getContentText() || res.getContentText() === 'null') return null;
    if (res.getResponseCode() !== 200) {
      const body = res.getContentText();
      // Don't crash the whole app on quota exhaustion: treat as "no data"
      // so callers can fall back to cache/sheets.
      if (res.getResponseCode() === 429 || _isQuotaExceeded(body)) {
        _rtdbMarkQuotaDown('lectura ' + path);
        return null;
      }
      throw new Error('rtdbGet error (' + path + '): ' + body);
    }
    return JSON.parse(res.getContentText());
  } catch (e) {
    if (_isQuotaExceeded(e)) {
      _rtdbMarkQuotaDown('lectura ' + path);
      return null;
    }
    throw e;
  }
}

/**
 * GET several RTDB paths in parallel (UrlFetchApp.fetchAll, chunks of 60).
 * Returns an array with the same length/order as `paths`; null for 404/empty.
 * @param {string[]} paths — e.g. ["units/2026-09-01_MAÑANA", "units/2026-09-01_TARDE", ...]
 * @returns {Array<object|null>}
 */
function rtdbGetAll(paths) {
  if (!paths || paths.length === 0) return [];
  if (_rtdbQuotaDown()) return new Array(paths.length).fill(null);
  const auth = _rtdbAuth();
  const secret = auth.useSecret ? auth.secret : '';
  const token = secret ? '' : _getRTDBToken();
  const results = new Array(paths.length);
  const CHUNK = 60;
  for (let start = 0; start < paths.length; start += CHUNK) {
    const chunk = paths.slice(start, start + CHUNK);
    const requests = chunk.map(path => {
      const req = {
        url: RTDB_BASE + '/' + path + '.json' + (secret ? '?auth=' + encodeURIComponent(secret) : ''),
        method: 'get',
        muteHttpExceptions: true
      };
      if (!secret) req.headers = { Authorization: 'Bearer ' + token };
      return req;
    });
    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (eAll) {
      if (_isQuotaExceeded(eAll)) {
        _rtdbMarkQuotaDown('lectura multiple');
        for (let i = start; i < paths.length; i++) results[i] = null;
        return results;
      }
      throw eAll;
    }
    for (let i = 0; i < responses.length; i++) {
      _fbReads++;
      const code = responses[i].getResponseCode();
      const text = responses[i].getContentText();
      if (code === 404 || !text || text === 'null') {
        results[start + i] = null;
        continue;
      }
      if (code !== 200) {
        if (code === 429 || _isQuotaExceeded(text)) {
          _rtdbMarkQuotaDown('lectura multiple');
          results[start + i] = null;
          continue;
        }
        throw new Error('rtdbGetAll error (' + chunk[i] + '): ' + text);
      }
      results[start + i] = JSON.parse(text);
    }
  }
  return results;
}

/**
 * Upsert data at RTDB path (PATCH = merge).
 * @param {string} path — e.g. "units/2026-06-02_TARDE/1A_ABC123"
 * @param {object} data — plain JS object
 */
function rtdbSet(path, data) {
  if (_rtdbQuotaDown()) throw new Error('rtdbSet: cuota RTDB agotada (marcada), se usa respaldo en hojas');
  try {
    const auth = _rtdbAuth();
    const secret = auth.useSecret ? auth.secret : '';
    const url = RTDB_BASE + '/' + path + '.json' + (secret ? '?auth=' + encodeURIComponent(secret) : '');
    const options = {
      method: 'patch',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    if (!secret) {
      const token = _getRTDBToken();
      options.headers.Authorization = 'Bearer ' + token;
    }
    const res0 = UrlFetchApp.fetch(url, options);
    let res = res0;
    if (secret && (res0.getResponseCode() === 401 || res0.getResponseCode() === 403)) {
      _rtdbMarkSecretRejected(res0.getResponseCode());
      const token = _getRTDBToken();
      res = UrlFetchApp.fetch(RTDB_BASE + '/' + path + '.json', {
        method: 'patch',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        payload: JSON.stringify(data),
        muteHttpExceptions: true
      });
    }

    _fbWrites++;
    if (res.getResponseCode() !== 200) {
      const body = res.getContentText();
      if (res.getResponseCode() === 429 || _isQuotaExceeded(body)) {
        _rtdbMarkQuotaDown('escritura ' + path);
        throw new Error('rtdbSet quota: ' + body);
      }
      throw new Error('rtdbSet error (' + path + '): ' + body);
    }
    return JSON.parse(res.getContentText());
  } catch (e) {
    if (_isQuotaExceeded(e)) {
      _rtdbMarkQuotaDown('escritura ' + path);
      throw new Error('rtdbSet quota: ' + ((e && e.message) || e));
    }
    throw e;
  }
}

/**
 * Multi-path update: one PATCH to the database root. Keys are relative paths.
 * A null value deletes that path. This is the cheapest way to write several
 * RTDB locations in a single UrlFetch call.
 * @param {Object<string, object|null>} updates
 */
function rtdbPatchMulti(updates) {
  if (!updates || Object.keys(updates).length === 0) return null;
  if (_rtdbQuotaDown()) throw new Error('rtdbPatchMulti: cuota RTDB agotada (marcada), se usa respaldo en hojas');

  try {
    const auth = _rtdbAuth();
    const secret = auth.useSecret ? auth.secret : '';
    const url = RTDB_BASE + '/.json' + (secret ? '?auth=' + encodeURIComponent(secret) : '');
    const options = {
      method: 'patch',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(updates),
      muteHttpExceptions: true
    };
    if (!secret) {
      const token = _getRTDBToken();
      options.headers.Authorization = 'Bearer ' + token;
    }

    let res = UrlFetchApp.fetch(url, options);
    if (secret && (res.getResponseCode() === 401 || res.getResponseCode() === 403)) {
      // El secret no sirve: se reintenta con OAuth para no perder el guardado.
      _rtdbMarkSecretRejected(res.getResponseCode());
      const token = _getRTDBToken();
      res = UrlFetchApp.fetch(RTDB_BASE + '/.json', {
        method: 'patch',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        payload: JSON.stringify(updates),
        muteHttpExceptions: true
      });
    }
    _fbWrites++;
    if (res.getResponseCode() !== 200) {
      const body = res.getContentText();
      if (res.getResponseCode() === 429 || _isQuotaExceeded(body)) {
        _rtdbMarkQuotaDown('escritura multiple');
        throw new Error('rtdbPatchMulti quota exceeded: ' + body);
      }
      throw new Error('rtdbPatchMulti error: ' + body);
    }
    return JSON.parse(res.getContentText() || 'null');
  } catch (e) {
    if (_isQuotaExceeded(e)) {
      _rtdbMarkQuotaDown('escritura multiple');
      throw new Error('rtdbPatchMulti quota exceeded: ' + ((e && e.message) || e));
    }
    throw e;
  }
}

/**
 * Batch upsert multiple paths in parallel.
 * @param {Array<{path:string, data:object}>} items
 */
function rtdbSetAll(items) {
  if (!items || items.length === 0) return [];
  if (_rtdbQuotaDown()) throw new Error('rtdbSetAll: cuota RTDB agotada (marcada), se usa respaldo en hojas');

  const auth = _rtdbAuth();
  const secret = auth.useSecret ? auth.secret : '';
  const token = secret ? '' : _getRTDBToken();
  const baseUrl = RTDB_BASE + '/';
  const CHUNK = 100;
  const results = [];

  for (let start = 0; start < items.length; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK);
    const requests = chunk.map(item => {
      const req = {
        url: baseUrl + item.path + '.json' + (secret ? '?auth=' + encodeURIComponent(secret) : ''),
        method: 'patch',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(item.data),
        muteHttpExceptions: true
      };
      if (!secret) req.headers.Authorization = 'Bearer ' + token;
      return req;
    });

    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (eAll) {
      if (_isQuotaExceeded(eAll)) {
        _rtdbMarkQuotaDown('escritura multiple');
        throw new Error('rtdbSetAll quota exceeded: ' + ((eAll && eAll.message) || eAll));
      }
      throw eAll;
    }
    for (let i = 0; i < responses.length; i++) {
      _fbWrites++;
      const code = responses[i].getResponseCode();
      if (code === 401 || code === 403) {
        if (secret) {
          _rtdbMarkSecretRejected(code);
          throw new Error('rtdbSetAll: secret rechazado (HTTP ' + code + ') en ' + chunk[i].path);
        }
      }
      if (code !== 200) {
        const body = responses[i].getContentText();
        if (code === 429 || _isQuotaExceeded(body)) {
          _rtdbMarkQuotaDown('escritura multiple');
          throw new Error('rtdbSetAll quota exceeded: ' + body);
        }
        throw new Error('rtdbSetAll error en ' + chunk[i].path + ': ' + body);
      }
      results.push(JSON.parse(responses[i].getContentText()));
    }
  }

  return results;
}
