// Google OAuth Authentication Module
// Handles Google Identity Services (GIS) for OAuth and gapi for Drive API access

// OAuth Configuration
const CLIENT_ID = '676763151176-88nc7gi3suv5cg0al4n2rvvv4575t00a.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Module state
let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
let authStateListeners = [];

/**
 * Initialize Google Auth - waits for both gapi and GIS libraries to load
 * @returns {Promise<boolean>} True when ready, false on error
 */
export async function initGoogleAuth() {
  try {
    // Wait for both libraries to be available
    await waitForGapi();
    await initializeGapiClient();
    await waitForGis();
    initializeGisClient();

    console.log('Google Auth initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Auth:', error);
    return false;
  }
}

/**
 * Check if user is currently signed in
 * @returns {boolean} True if signed in with valid token
 */
export function isSignedIn() {
  return accessToken !== null;
}

/**
 * Get current access token
 * @returns {string|null} Access token or null if not signed in
 */
export function getAccessToken() {
  return accessToken;
}

/**
 * Trigger Google OAuth sign-in popup
 * @returns {Promise<boolean>} True on successful sign-in
 */
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }

    // Set up callback for this sign-in attempt
    tokenClient.callback = (response) => {
      if (response.error) {
        console.error('Sign-in error:', response.error);
        reject(new Error(response.error));
        return;
      }

      accessToken = response.access_token;
      notifyAuthStateListeners();
      resolve(true);
    };

    // Check if we need consent or just a token refresh
    if (accessToken === null) {
      // First sign-in - request consent
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Already have token - just refresh
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

/**
 * Sign out - revoke token and clear state
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (accessToken) {
    // Revoke the token
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Token revoked');
    });
  }

  accessToken = null;
  notifyAuthStateListeners();
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with isSignedIn boolean when state changes
 */
export function onAuthStateChange(callback) {
  if (typeof callback === 'function' && !authStateListeners.includes(callback)) {
    authStateListeners.push(callback);
  }
}

/**
 * Unsubscribe from auth state changes
 * @param {Function} callback - Previously registered callback
 */
export function offAuthStateChange(callback) {
  const index = authStateListeners.indexOf(callback);
  if (index > -1) {
    authStateListeners.splice(index, 1);
  }
}

// --- Internal Functions ---

/**
 * Wait for gapi library to load (from script tag in index.html)
 * @returns {Promise<void>}
 */
function waitForGapi() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof gapi !== 'undefined') {
      resolve();
      return;
    }

    // Poll for gapi availability (loaded async from script tag)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds
    const interval = setInterval(() => {
      attempts++;
      if (typeof gapi !== 'undefined') {
        clearInterval(interval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for gapi library'));
      }
    }, 100);
  });
}

/**
 * Initialize gapi client with Drive API discovery doc
 * @returns {Promise<void>}
 */
async function initializeGapiClient() {
  await new Promise((resolve) => gapi.load('client', resolve));

  await gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  });

  gapiInited = true;
  console.log('gapi client initialized');
}

/**
 * Wait for Google Identity Services library to load
 * @returns {Promise<void>}
 */
function waitForGis() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof google !== 'undefined' && google.accounts) {
      resolve();
      return;
    }

    // Poll for GIS availability
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds
    const interval = setInterval(() => {
      attempts++;
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(interval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for Google Identity Services'));
      }
    }, 100);
  });
}

/**
 * Initialize Google Identity Services token client
 */
function initializeGisClient() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // Will be set per sign-in request
  });

  gisInited = true;
  console.log('GIS client initialized');
}

/**
 * Notify all registered auth state listeners
 */
function notifyAuthStateListeners() {
  const signedIn = isSignedIn();
  authStateListeners.forEach(callback => {
    try {
      callback(signedIn);
    } catch (error) {
      console.error('Auth state listener error:', error);
    }
  });
}
