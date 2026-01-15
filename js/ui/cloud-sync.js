// Cloud Sync UI Module
// Handles cloud sync button, status indicator, and sign-in/sign-out flow

import { initGoogleAuth, isSignedIn, signIn, signOut, onAuthStateChange } from '../storage/google-auth.js';

// DOM references
let syncButton = null;
let statusSpan = null;

// UI callbacks injected via init
let uiCallbacks = {
  Info: null,
  Warning: null,
  ErrorMsg: null,
  showModal: null,
  hideModal: null
};

/**
 * Initialize cloud sync UI
 * @param {object} deps - Dependencies from app.js
 * @param {HTMLElement} deps.btnCloudSync - Sync button element
 * @param {HTMLElement} deps.syncStatus - Status span element
 * @param {function} deps.Info - Info message function
 * @param {function} deps.Warning - Warning message function
 * @param {function} deps.ErrorMsg - Error message function
 * @param {function} deps.showModal - Show modal function
 * @param {function} deps.hideModal - Hide modal function
 */
export async function initCloudSync(deps) {
  // Store DOM refs
  syncButton = deps.btnCloudSync;
  statusSpan = deps.syncStatus;

  // Store UI callbacks
  uiCallbacks.Info = deps.Info;
  uiCallbacks.Warning = deps.Warning;
  uiCallbacks.ErrorMsg = deps.ErrorMsg;
  uiCallbacks.showModal = deps.showModal;
  uiCallbacks.hideModal = deps.hideModal;

  // Initialize Google Auth
  const authReady = await initGoogleAuth();
  if (!authReady) {
    uiCallbacks.Warning?.('Cloud sync unavailable - Google Auth failed to initialize');
    syncButton.disabled = true;
    return;
  }

  // Listen for auth state changes
  onAuthStateChange(handleAuthStateChange);

  // Wire up button click handler
  syncButton.addEventListener('click', handleSyncButtonClick);

  // Add context menu for sign-out option when signed in
  syncButton.addEventListener('contextmenu', handleRightClick);

  // Update initial UI state
  updateSyncUI();
}

/**
 * Update sync button and status based on auth state
 */
export function updateSyncUI() {
  if (!syncButton || !statusSpan) return;

  if (isSignedIn()) {
    syncButton.textContent = '☁️ Synced';
    syncButton.title = 'Cloud sync active. Right-click to sign out.';
    setSyncStatus('synced');
  } else {
    syncButton.textContent = '☁️ Sign In';
    syncButton.title = 'Sign in to Google Drive to sync your recipes across devices';
    setSyncStatus('offline');
  }
}

/**
 * Set the sync status indicator
 * @param {'syncing' | 'synced' | 'error' | 'offline'} status - Status to display
 */
export function setSyncStatus(status) {
  if (!statusSpan) return;

  // Clear all status classes
  statusSpan.classList.remove('syncing', 'synced', 'error', 'offline');

  switch (status) {
    case 'syncing':
      statusSpan.classList.add('syncing');
      statusSpan.textContent = '↻';
      statusSpan.title = 'Syncing...';
      break;
    case 'synced':
      statusSpan.classList.add('synced');
      statusSpan.textContent = '✓';
      statusSpan.title = 'Synced with Google Drive';
      break;
    case 'error':
      statusSpan.classList.add('error');
      statusSpan.textContent = '!';
      statusSpan.title = 'Sync error';
      break;
    case 'offline':
      statusSpan.classList.add('offline');
      statusSpan.textContent = '';
      statusSpan.title = 'Not signed in';
      break;
  }
}

// --- Internal Functions ---

/**
 * Handle sync button click
 * - If not signed in: trigger sign-in
 * - If signed in: manual sync (placeholder for Plan 04)
 */
async function handleSyncButtonClick() {
  if (!isSignedIn()) {
    await handleSignIn();
  } else {
    // Placeholder for manual sync - will be wired in Plan 04
    uiCallbacks.Info?.('Already synced');
  }
}

/**
 * Handle sign-in flow
 */
async function handleSignIn() {
  syncButton.disabled = true;
  syncButton.textContent = '☁️ Signing in...';
  setSyncStatus('syncing');

  try {
    await signIn();
    uiCallbacks.Info?.('Signed in to Google Drive');
  } catch (error) {
    console.error('Sign-in failed:', error);
    uiCallbacks.ErrorMsg?.('Sign-in failed: ' + error.message);
    setSyncStatus('error');
  } finally {
    syncButton.disabled = false;
    updateSyncUI();
  }
}

/**
 * Handle right-click on sync button (sign-out option)
 * @param {MouseEvent} event
 */
function handleRightClick(event) {
  if (!isSignedIn()) return;

  event.preventDefault();
  showSignOutOption();
}

/**
 * Show sign-out confirmation modal
 */
function showSignOutOption() {
  if (!uiCallbacks.showModal) return;

  const content = document.createElement('div');
  content.innerHTML = `
    <h3>Sign out of Google Drive?</h3>
    <p>Your recipes will remain on your device but won't sync to the cloud.</p>
  `;

  const buttons = document.createElement('div');

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => uiCallbacks.hideModal?.();

  const signOutBtn = document.createElement('button');
  signOutBtn.textContent = 'Sign Out';
  signOutBtn.onclick = handleSignOut;

  buttons.appendChild(cancelBtn);
  buttons.appendChild(signOutBtn);

  uiCallbacks.showModal(content, buttons);
}

/**
 * Handle sign-out action
 */
async function handleSignOut() {
  uiCallbacks.hideModal?.();

  try {
    await signOut();
    uiCallbacks.Info?.('Signed out of Google Drive');
    updateSyncUI();
  } catch (error) {
    console.error('Sign-out failed:', error);
    uiCallbacks.ErrorMsg?.('Sign-out failed: ' + error.message);
  }
}

/**
 * Handle auth state change from google-auth module
 * @param {boolean} _signedIn - Whether user is signed in (unused, state checked via isSignedIn())
 */
function handleAuthStateChange(_signedIn) {
  updateSyncUI();
}
