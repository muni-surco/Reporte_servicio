/**
 * Firebase.gs — Firestore REST API integration for Google Apps Script.
 * Uses service account to authenticate via OAuth2 JWT bearer token.
 * 
 * Setup: Run setupFirebase(JSON.stringify(serviceAccountKey)) from GAS editor.
 *        Service account key from Firebase Console > Project Settings > Service Accounts.
 */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects';

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
      if (responses[i].getResponseCode() !== 200) {
        throw new Error('fbSetAll error en ' + chunk[i].docId + ': ' + responses[i].getContentText());
      }
      results.push(_fromFields(JSON.parse(responses[i].getContentText()).fields));
    }
  }

  return results;
}

/**
 * Run a Firestore structured query.
 * @param {string} collection
 * @param {Array<{field:string, value:string, op?:string}>} filters
 *   op: 'EQUAL' (default), 'LESS_THAN', 'GREATER_THAN', 'ARRAY_CONTAINS', etc.
 * @param {string|null} orderByField — field to sort by DESCENDING
 * @param {number|null} limit — max results
 * @param {string|null} orderDirection — 'DESCENDING' (default) or 'ASCENDING'
 * @returns {Array<object>} matching documents
 */
function fbQuery(collection, filters, orderByField, limit, orderDirection) {
  const token = _getFirebaseToken();
  const config = _getFirebaseConfig();
  const url = FIRESTORE_BASE + '/' + _fsEncode(config.project_id)
    + '/databases/(default)/documents:runQuery';

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

  if (limit) {
    query.structuredQuery.limit = limit;
  }

  const res = UrlFetchApp.fetch(url, {
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

  const results = JSON.parse(res.getContentText());
  return results
    .filter(r => r.document)
    .map(r => {
      const obj = _fromFields(r.document.fields);
      obj._id = r.document.name.split('/').pop();
      return obj;
    });
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
