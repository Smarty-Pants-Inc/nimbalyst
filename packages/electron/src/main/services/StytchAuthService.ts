/**
 * StytchAuthService - compatibility-named auth service backed by the smarty-sync auth Worker.
 *
 * This service handles:
 * - Google OAuth sign-in/sign-up (via browser redirect to auth Worker)
 * - Email magic link authentication (via auth Worker)
 * - Session token/JWT management
 * - Organization context (org_id)
 *
 * Security architecture:
 * - All authentication flows go through the auth Worker
 * - The desktop app never has access to provider secrets
 * - OAuth flow: opens browser -> auth Worker -> provider -> nimbalyst:// deep link
 * - Magic links: auth Worker sends email/validates token, then this service stores the returned session
 * - Session tokens received via deep link are stored securely using Electron's safeStorage
 * - JWT is used for sync server authentication and includes org context
 *
 * Deep link format: nimbalyst://auth/callback?session_token=...&session_jwt=...&user_id=...&email=...&org_id=...
 */

import { safeStorage, shell } from 'electron';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getSessionSyncConfig, setSessionSyncConfig } from '../utils/store';
import { AnalyticsService } from './analytics/AnalyticsService';

const AUTH_WORKER_BASE_URL = 'https://smarty-sync-auth-dev.frosty-wildflower-6a9b.workers.dev';
const AUTH_WORKER_DEVELOPMENT_BASE_URL = 'http://localhost:8790';
const AUTH_CALLBACK_BASE_URL = 'nimbalyst://auth/callback';

// Compatibility types retained for existing callers.
interface StytchUser {
  user_id: string;
  emails: Array<{
    email_id: string;
    email: string;
    verified: boolean;
  }>;
  name?: {
    first_name?: string;
    last_name?: string;
  };
  created_at: string;
  status: 'active' | 'pending';
}

interface StytchSession {
  session_id: string;
  user_id: string;
  started_at: string;
  last_accessed_at: string;
  expires_at: string;
  authentication_factors: Array<{
    type: string;
    delivery_method: string;
    last_authenticated_at: string;
  }>;
}

interface StytchAuthState {
  isAuthenticated: boolean;
  user: StytchUser | null;
  session: StytchSession | null;
  sessionToken: string | null;
  sessionJwt: string | null;
  /** Organization ID from B2B auth (may change on session exchange). */
  orgId: string | null;
  /** Personal org ID -- set once on initial auth, never overwritten by session exchanges.
   *  Used for session sync room IDs so they stay stable across org switches. */
  personalOrgId: string | null;
  /** Personal org member ID -- set once on initial auth, never overwritten by session exchanges.
   *  Each org can have its own member record. After a team session exchange,
   *  the JWT sub claim changes to the team org member ID. This field preserves the
   *  personal org member ID so sync room IDs and encryption keys stay stable. */
  personalUserId: string | null;
  /** Personal-org-scoped JWT -- separate from sessionJwt which may be team-scoped.
   *  Used exclusively for session sync (IndexRoom, session rooms) where the server
   *  validates JWT sub === room userId. */
  personalSessionJwt: string | null;
}

interface StoredStytchCredentials {
  sessionToken: string;
  sessionJwt: string;
  refreshToken?: string;
  userId: string;
  email?: string;
  expiresAt: number;
  /** Organization ID from B2B auth (may change on session exchange) */
  orgId?: string;
  /** Personal org ID -- set once on initial auth, stable across session exchanges */
  personalOrgId?: string;
  /** Personal org member ID -- set once on initial auth, stable across session exchanges */
  personalUserId?: string;
}

/**
 * Multi-account storage format (v2).
 * Each account is keyed by personalOrgId.
 */
interface StoredAccountsData {
  version: 2;
  primaryAccountId: string; // personalOrgId of the primary account
  accounts: StoredStytchCredentials[];
}

/**
 * Public account info exposed to the renderer (no JWTs or tokens).
 */
export interface AccountInfo {
  personalOrgId: string;
  personalUserId: string | null;
  email: string | null;
  userName?: string;
  isPrimary: boolean;
}


// Legacy initialization shape retained for existing callers.
interface StytchConfig {
  projectId: string;
  publicToken: string;
  apiBase: string;
}

// File names for persistent storage
const AUTH_CREDENTIALS_FILE = 'auth-worker-credentials.enc'; // v1 (single account)
const AUTH_ACCOUNTS_FILE = 'auth-worker-accounts.enc'; // v2 (multi-account)

// Singleton state -- represents the primary account for backward compat.
// All existing getters (getAuthState, getSessionJwt, etc.) read from this.
let authState: StytchAuthState = {
  isAuthenticated: false,
  user: null,
  session: null,
  sessionToken: null,
  sessionJwt: null,
  orgId: null,
  personalOrgId: null,
  personalUserId: null,
  personalSessionJwt: null,
};

// Multi-account state -- all accounts keyed by personalOrgId.
const accounts = new Map<string, StoredStytchCredentials>();
let primaryAccountId: string | null = null;

let authWorkerConfig: StytchConfig | null = null;

// Event listeners for auth state changes
type AuthStateListener = (state: StytchAuthState) => void;
const authStateListeners = new Set<AuthStateListener>();

/**
 * Get the path to the encrypted credentials file (v1 single-account).
 */
function getCredentialsPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, AUTH_CREDENTIALS_FILE);
}

/**
 * Get the path to the multi-account credentials file (v2).
 */
function getAccountsPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, AUTH_ACCOUNTS_FILE);
}


/**
 * Check if safeStorage is available for encryption.
 */
function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Save auth credentials securely.
 */
function saveStytchCredentials(credentials: StoredStytchCredentials): void {
  const credentialsPath = getCredentialsPath();
  const jsonData = JSON.stringify(credentials);

  if (isSafeStorageAvailable()) {
    const encrypted = safeStorage.encryptString(jsonData);
    fs.writeFileSync(credentialsPath, encrypted);
    // logger.main.info('[StytchAuthService] Credentials saved with safeStorage encryption');
  } else {
    logger.main.warn('[StytchAuthService] safeStorage not available - saving credentials without encryption');
    fs.writeFileSync(credentialsPath, jsonData, 'utf8');
  }
}

/**
 * Load auth credentials from secure storage.
 */
function loadStytchCredentials(): StoredStytchCredentials | null {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const fileData = fs.readFileSync(credentialsPath);

    if (isSafeStorageAvailable()) {
      const decrypted = safeStorage.decryptString(fileData);
      return JSON.parse(decrypted);
    } else {
      const jsonData = fileData.toString('utf8');
      return JSON.parse(jsonData);
    }
  } catch (error) {
    logger.main.error('[StytchAuthService] Failed to load credentials:', error);
    return null;
  }
}

/**
 * Clear stored auth credentials.
 */
function clearStytchCredentials(): void {
  const credentialsPath = getCredentialsPath();
  if (fs.existsSync(credentialsPath)) {
    fs.unlinkSync(credentialsPath);
    logger.main.info('[StytchAuthService] Credentials cleared');
  }
}

// ============================================================================
// Multi-Account Storage (v2)
// ============================================================================

/**
 * Save all accounts to the multi-account file.
 */
function saveAllAccounts(): void {
  if (accounts.size === 0) {
    // No accounts -- remove the file
    const accountsPath = getAccountsPath();
    if (fs.existsSync(accountsPath)) {
      fs.unlinkSync(accountsPath);
    }
    return;
  }

  const data: StoredAccountsData = {
    version: 2,
    primaryAccountId: primaryAccountId || '',
    accounts: Array.from(accounts.values()),
  };

  const accountsPath = getAccountsPath();
  const jsonData = JSON.stringify(data);

  if (isSafeStorageAvailable()) {
    const encrypted = safeStorage.encryptString(jsonData);
    fs.writeFileSync(accountsPath, encrypted);
  } else {
    logger.main.warn('[StytchAuthService] safeStorage not available - saving accounts without encryption');
    fs.writeFileSync(accountsPath, jsonData, 'utf8');
  }
}

/**
 * Load accounts from storage.
 * Handles migration from v1 (single account) to v2 (multi-account).
 * Returns true if any accounts were loaded.
 */
function loadAllAccounts(): boolean {
  // Try v2 format first
  const accountsPath = getAccountsPath();
  if (fs.existsSync(accountsPath)) {
    try {
      const fileData = fs.readFileSync(accountsPath);
      let jsonData: string;
      if (isSafeStorageAvailable()) {
        jsonData = safeStorage.decryptString(fileData);
      } else {
        jsonData = fileData.toString('utf8');
      }
      const data = JSON.parse(jsonData) as StoredAccountsData;
      if (data.version === 2 && Array.isArray(data.accounts)) {
        accounts.clear();
        for (const acct of data.accounts) {
          if (acct.personalOrgId) {
            accounts.set(acct.personalOrgId, acct);
          }
        }
        primaryAccountId = data.primaryAccountId || null;
        logger.main.info(`[StytchAuthService] Loaded ${accounts.size} accounts (v2 format)`);
        return accounts.size > 0;
      }
    } catch (error) {
      logger.main.error('[StytchAuthService] Failed to load v2 accounts:', error);
    }
  }

  // Migrate from v1 single-account format
  const v1Creds = loadStytchCredentials();
  if (v1Creds && v1Creds.personalOrgId) {
    accounts.clear();
    accounts.set(v1Creds.personalOrgId, v1Creds);
    primaryAccountId = v1Creds.personalOrgId;

    // Save in v2 format
    saveAllAccounts();

    logger.main.info('[StytchAuthService] Migrated v1 credentials to v2 multi-account format');
    return true;
  }

  return false;
}

/**
 * Update a specific account's credentials in the map and persist.
 */
function updateAccountCredentials(personalOrgId: string, update: Partial<StoredStytchCredentials>): void {
  const existing = accounts.get(personalOrgId);
  if (existing) {
    accounts.set(personalOrgId, { ...existing, ...update });
    saveAllAccounts();
  }
}

/**
 * Notify all listeners of auth state change.
 */
function notifyAuthStateChange(): void {
  const state = { ...authState };
  authStateListeners.forEach(listener => {
    try {
      listener(state);
    } catch (error) {
      logger.main.error('[StytchAuthService] Auth state listener error:', error);
    }
  });
}

/**
 * Update auth state and notify listeners.
 */
function updateAuthState(update: Partial<StytchAuthState>): void {
  authState = { ...authState, ...update };
  notifyAuthStateChange();
}

interface AuthWorkerEmailStartResponse {
  ok?: boolean;
  devToken?: string;
  error?: string;
}

interface AuthWorkerSessionResponse {
  sessionJwt: string;
  refreshToken?: string;
  userId?: string;
  orgId?: string;
  email?: string;
}

function buildAuthCallbackUrl(params: {
  sessionJwt: string;
  userId: string;
  email: string;
  orgId: string;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set('session_token', params.sessionJwt);
  searchParams.set('session_jwt', params.sessionJwt);
  searchParams.set('user_id', params.userId);
  searchParams.set('email', params.email);
  searchParams.set('org_id', params.orgId);
  return `${AUTH_CALLBACK_BASE_URL}?${searchParams.toString()}`;
}

function decodeJwtSub(jwt: string | null): string | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = payloadBase64.padEnd(payloadBase64.length + ((4 - payloadBase64.length % 4) % 4), '=');
    const payload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8')) as { sub?: string };
    return payload.sub || null;
  } catch {
    return null;
  }
}

function normalizeAuthWorkerBaseUrl(serverUrl?: string): string {
  const explicitUrl = serverUrl?.trim();
  if (explicitUrl) {
    return explicitUrl
      .replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace(/\/+$/, '');
  }

  const config = getSessionSyncConfig();
  const isDev = process.env.NODE_ENV !== 'production';
  return isDev && config?.environment === 'development'
    ? AUTH_WORKER_DEVELOPMENT_BASE_URL
    : AUTH_WORKER_BASE_URL;
}

async function postAuthWorker<T>(pathName: string, body: unknown, serverUrl?: string): Promise<T> {
  const response = await fetch(`${normalizeAuthWorkerBaseUrl(serverUrl)}${pathName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(data.error || `Auth worker request failed: ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }
  return data;
}


// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the compatibility auth service.
 * Call this during app startup.
 *
 * IMPORTANT: Do not pass provider secrets to the desktop app.
 */
export function initializeStytchAuth(config: StytchConfig): void {
  authWorkerConfig = config;

  logger.main.info('[StytchAuthService] Initialized auth worker:', normalizeAuthWorkerBaseUrl(), config.projectId);

  // Try to load multi-account data (v2), migrating from v1 if needed
  loadAllAccounts();

  // Restore the primary account into the singleton authState
  const savedCredentials = primaryAccountId ? accounts.get(primaryAccountId) ?? null : loadStytchCredentials();
  if (savedCredentials && savedCredentials.expiresAt > Date.now() && savedCredentials.orgId) {
    // Validate JWT format (must be 3 parts separated by dots)
    const hasValidJwt = savedCredentials.sessionJwt && savedCredentials.sessionJwt.split('.').length === 3;

    // On restore, personalSessionJwt is only valid if we're still in the personal org.
    // If a team exchange happened, personalSessionJwt will be set when SyncManager calls
    // resolvePersonalUserId() or refreshPersonalSession().
    const isInPersonalOrg = !savedCredentials.orgId || !savedCredentials.personalOrgId
      || savedCredentials.orgId === savedCredentials.personalOrgId;
    const restoredJwt = hasValidJwt ? savedCredentials.sessionJwt : null;

    // Use updateAuthState to notify listeners (like RepositoryManager) of the restored session
    updateAuthState({
      isAuthenticated: true,
      user: savedCredentials.userId ? {
        user_id: savedCredentials.userId,
        emails: savedCredentials.email ? [{ email_id: '', email: savedCredentials.email, verified: true }] : [],
        created_at: new Date().toISOString(),
        status: 'active',
      } : null,
      session: null,
      sessionToken: savedCredentials.sessionToken,
      sessionJwt: restoredJwt,
      orgId: savedCredentials.orgId,
      personalOrgId: savedCredentials.personalOrgId || null,
      personalUserId: savedCredentials.personalUserId || null,
      personalSessionJwt: isInPersonalOrg ? restoredJwt : null,
    });
    // One-time migration: if personalOrgId is missing (pre-existing creds from before
    // this field was added), persist the current orgId as personalOrgId.
    // At the time those creds were saved, the orgId WAS the personal org.
    let needsSave = false;
    if (!savedCredentials.personalOrgId && savedCredentials.orgId) {
      savedCredentials.personalOrgId = savedCredentials.orgId;
      authState.personalOrgId = savedCredentials.orgId;
      needsSave = true;
      logger.main.info('[StytchAuthService] Migrated orgId to personalOrgId:', savedCredentials.orgId);
    }
    // One-time migration: if personalUserId is missing, try to persist the current userId.
    // BUT: if orgId !== personalOrgId, a team session exchange already happened and the
    // stored userId is the TEAM member ID (not personal). In that case, SyncManager will
    // call resolvePersonalUserId() during async init to exchange to the personal org
    // and extract the correct member ID.
    if (!savedCredentials.personalUserId && savedCredentials.userId) {
      if (!savedCredentials.orgId || !savedCredentials.personalOrgId || savedCredentials.orgId === savedCredentials.personalOrgId) {
        // No team exchange happened yet -- userId IS the personal member ID
        savedCredentials.personalUserId = savedCredentials.userId;
        authState.personalUserId = savedCredentials.userId;
        needsSave = true;
        logger.main.info('[StytchAuthService] Migrated userId to personalUserId:', savedCredentials.userId);
      } else {
        logger.main.warn('[StytchAuthService] personalUserId missing and orgId differs from personalOrgId.',
          'Will resolve via session exchange to personal org during sync init.');
      }
    }
    if (needsSave) {
      saveStytchCredentials(savedCredentials);
    }
    logger.main.info('[StytchAuthService] Restored session for user:', savedCredentials.userId, savedCredentials.email, {
      hasValidJwt,
      orgId: savedCredentials.orgId,
      personalOrgId: authState.personalOrgId,
    });

    // If JWT is missing or invalid, try to refresh the session
    if (!hasValidJwt) {
      logger.main.info('[StytchAuthService] Stored session has no valid JWT - will attempt refresh');
      // Schedule refresh after initialization completes (don't block startup)
      setImmediate(async () => {
        try {
          const refreshed = await refreshSession();
          if (refreshed) {
            logger.main.info('[StytchAuthService] Session refreshed on startup - JWT now available');
          } else {
            logger.main.warn('[StytchAuthService] Session refresh failed on startup - signing out');
            await signOut();
          }
        } catch (error) {
          if ((error as any)?.isNetworkError) {
            logger.main.warn('[StytchAuthService] Network error during startup refresh - keeping credentials');
          } else {
            logger.main.error('[StytchAuthService] Unexpected error during startup refresh:', error);
          }
        }
      });
    } else {
      // JWT looks valid locally, but verify it's still alive server-side
      setImmediate(async () => {
        try {
          const refreshed = await refreshSession();
          if (!refreshed) {
            logger.main.warn('[StytchAuthService] Session dead server-side on startup - signing out');
            await signOut();
          }
        } catch (error) {
          if ((error as any)?.isNetworkError) {
            logger.main.warn('[StytchAuthService] Network error during startup verification - keeping credentials');
          } else {
            logger.main.error('[StytchAuthService] Unexpected error during startup verification:', error);
          }
        }
      });
    }
  } else if (savedCredentials) {
    const reason = !savedCredentials.orgId ? 'missing orgId (pre-B2B credential)' : 'expired';
    logger.main.info(`[StytchAuthService] Saved session invalid: ${reason}, clearing`);
    clearStytchCredentials();
  }
}

/**
 * Handle auth callback from deep link (nimbalyst://auth/callback?...)
 * Called when user completes auth flow and is redirected back to the app.
 */
export async function handleAuthCallback(params: {
  sessionToken: string;
  sessionJwt?: string;
  userId?: string;
  email?: string;
  expiresAt?: string;
  orgId?: string;
}): Promise<void> {
  await persistAuthCallback(params);
}

async function persistAuthCallback(params: {
  sessionToken: string;
  sessionJwt?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  expiresAt?: string;
  orgId?: string;
}): Promise<void> {
  const { sessionToken, sessionJwt, refreshToken, userId, email, expiresAt, orgId } = params;

  // Calculate expiry time
  let expiresAtMs = Date.now() + (7 * 24 * 60 * 60 * 1000); // Default: 1 week
  if (expiresAt) {
    try {
      expiresAtMs = new Date(expiresAt).getTime();
    } catch {
      // Use default
    }
  }

  // Validate JWT format (must be 3 parts separated by dots)
  const validatedJwt = sessionJwt && sessionJwt.split('.').length === 3 ? sessionJwt : null;
  if (sessionJwt && !validatedJwt) {
    logger.main.warn('[StytchAuthService] Auth callback received invalid JWT format');
  }

  // Determine the personalOrgId for this callback.
  // On initial auth, orgId IS the personal org. On re-auth, preserve existing value.
  const incomingPersonalOrgId = orgId || null;

  // Only treat as secondary if the primary account is still valid/active.
  // If primary session is expired or not authenticated, the new login should replace it.
  const primaryIsActive = primaryAccountId !== null && authState.isAuthenticated
    && accounts.has(primaryAccountId)
    && (accounts.get(primaryAccountId)!.expiresAt > Date.now());
  const isSecondaryAccount = primaryIsActive && incomingPersonalOrgId !== null
    && incomingPersonalOrgId !== primaryAccountId;

  // Build credentials to persist. sessionToken is legacy host surface; for auth-worker
  // callbacks without a separate token, it is the same opaque value as sessionJwt.
  const credsToSave: StoredStytchCredentials = {
    sessionToken,
    sessionJwt: validatedJwt || '',
    refreshToken,
    userId: userId || '',
    email: email || '',
    expiresAt: expiresAtMs,
    orgId,
    personalOrgId: incomingPersonalOrgId || undefined,
    personalUserId: userId || undefined,
  };

  if (isSecondaryAccount) {
    // Adding a secondary account: update accounts map but DON'T touch the singleton authState.
    // The primary account's getters (getAuthState, getSessionJwt, etc.) stay unchanged.
    accounts.set(incomingPersonalOrgId!, credsToSave);
    saveAllAccounts();
    logger.main.info('[StytchAuthService] Added secondary account:', email, incomingPersonalOrgId);
  } else {
    // Primary account: first sign-in, re-auth of existing primary, or replacing expired primary.
    // When the incoming org differs from the stored primary (expired primary being replaced),
    // use the incoming values instead of preserving stale state.
    const isReplacingPrimary = primaryAccountId !== null && incomingPersonalOrgId !== primaryAccountId;
    if (isReplacingPrimary) {
      logger.main.info('[StytchAuthService] Replacing expired primary account:', primaryAccountId, '->', incomingPersonalOrgId);
    }
    const personalOrgId = isReplacingPrimary ? incomingPersonalOrgId : (authState.personalOrgId || incomingPersonalOrgId);
    const personalUserId = isReplacingPrimary ? (userId || null) : (authState.personalUserId || userId || null);

    // Update singleton auth state
    updateAuthState({
      isAuthenticated: true,
      user: userId ? {
        user_id: userId,
        emails: email ? [{ email_id: '', email, verified: true }] : [],
        created_at: new Date().toISOString(),
        status: 'active',
      } : null,
      session: null,
      sessionToken,
      sessionJwt: validatedJwt,
      orgId: orgId || null,
      personalOrgId,
      personalUserId,
      personalSessionJwt: validatedJwt,
    });

    // Update credentials with resolved personalOrgId/userId
    credsToSave.personalOrgId = personalOrgId || undefined;
    credsToSave.personalUserId = personalUserId || undefined;

    // Save legacy file
    saveStytchCredentials(credsToSave);

    // Update multi-account store
    if (personalOrgId) {
      accounts.set(personalOrgId, credsToSave);
      if (!primaryAccountId || isReplacingPrimary) {
        primaryAccountId = personalOrgId;
      }
      saveAllAccounts();
    }
  }

  // Bootstrap sync config if it doesn't exist yet.
  // Teams and sync operations need this config to exist, even if sync isn't enabled.
  const existingConfig = getSessionSyncConfig();
  if (!existingConfig) {
    setSessionSyncConfig({
      enabled: false,
      serverUrl: '',
      enabledProjects: [],
    });
    logger.main.info('[StytchAuthService] Created default sync config after auth');
  }

  // Track auth callback completion (authoritative sign-in event from deep link)
  AnalyticsService.getInstance().sendEvent('sync_auth_callback_completed');

  logger.main.info('[StytchAuthService] Auth callback processed:', {
    userId,
    email,
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(listener: AuthStateListener): () => void {
  authStateListeners.add(listener);
  // Immediately notify with current state
  listener({ ...authState });
  return () => authStateListeners.delete(listener);
}

/**
 * Get the current authentication state.
 */
export function getAuthState(): StytchAuthState {
  return { ...authState };
}

/**
 * Check if the user is authenticated.
 */
export function isAuthenticated(): boolean {
  return authState.isAuthenticated;
}

/**
 * Get the current user's auth worker user ID.
 */
export function getStytchUserId(): string | null {
  return authState.user?.user_id || null;
}

/**
 * Get the current user's email address.
 */
export function getUserEmail(): string | null {
  return authState.user?.emails?.[0]?.email || null;
}

/**
 * Get the current organization ID (may change on session exchange to team orgs).
 */
export function getOrgId(): string | null {
  return authState.orgId;
}

/**
 * Get the personal organization ID (stable across session exchanges).
 * Set once during initial auth, never overwritten by team session exchanges.
 * Used for session sync room IDs so they stay stable regardless of which org
 * the JWT is currently scoped to.
 */
export function getPersonalOrgId(): string | null {
  return authState.personalOrgId;
}

/**
 * Get the personal org member ID (stable across session exchanges).
 * Each org can have its own member record with a unique member ID.
 * After a team session exchange, the JWT sub claim and authState.user.user_id
 * change to the team org's member ID. This function returns the original
 * personal org member ID so sync room IDs and encryption keys stay consistent.
 */
export function getPersonalUserId(): string | null {
  return authState.personalUserId;
}

/**
 * Resolve the personal org member ID from the current JWT's sub claim.
 * This is needed when personalUserId is missing in persisted credentials.
 *
 * Returns the personal member ID, or null if resolution fails.
 */
export async function resolvePersonalUserId(serverUrl: string): Promise<string | null> {
  void serverUrl;

  // Already resolved
  if (authState.personalUserId) {
    return authState.personalUserId;
  }

  const jwt = authState.personalSessionJwt || authState.sessionJwt;
  if (!jwt) {
    logger.main.warn('[StytchAuthService] Cannot resolve personalUserId: no JWT');
    return null;
  }

  const personalUserId = decodeJwtSub(jwt);
  if (!personalUserId) {
    logger.main.error('[StytchAuthService] JWT sub claim missing from session response');
    return null;
  }

  authState = { ...authState, personalUserId, personalSessionJwt: jwt };
  const creds = loadStytchCredentials();
  if (creds) {
    saveStytchCredentials({ ...creds, personalUserId });
  }
  if (authState.personalOrgId) {
    updateAccountCredentials(authState.personalOrgId, { personalUserId });
  }

  logger.main.info('[StytchAuthService] Resolved personalUserId:', personalUserId);
  return personalUserId;
}

/**
 * Get the current session JWT for server authentication.
 * After a team session exchange, this may be a team-org-scoped JWT.
 */
export function getSessionJwt(): string | null {
  return authState.sessionJwt;
}

/**
 * Get the session JWT for a specific account by personalOrgId.
 * Falls back to the default getSessionJwt() if the account is the primary
 * or not found.
 */
export function getSessionJwtForAccount(personalOrgId: string): string | null {
  // If it's the primary account, just return the normal JWT
  if (personalOrgId === primaryAccountId) {
    return authState.sessionJwt;
  }
  const creds = accounts.get(personalOrgId);
  return creds?.sessionJwt ?? null;
}

/**
 * Get the session token for a specific account by personalOrgId.
 * Used for org-scoped JWT exchanges when operating under a non-primary account.
 */
export function getSessionTokenForAccount(personalOrgId: string): string | null {
  if (personalOrgId === primaryAccountId) {
    return authState.sessionToken;
  }
  const creds = accounts.get(personalOrgId);
  return creds?.sessionToken ?? null;
}

/**
 * Get all signed-in accounts (public info only, no JWTs or tokens).
 * Used by the renderer to display account list.
 */
export function getAccounts(): AccountInfo[] {
  const result: AccountInfo[] = [];
  for (const [orgId, creds] of accounts) {
    result.push({
      personalOrgId: orgId,
      personalUserId: creds.personalUserId || null,
      email: creds.email || null,
      isPrimary: orgId === primaryAccountId,
    });
  }
  return result;
}

/**
 * Get the personal-org-scoped JWT for session sync.
 * This JWT's sub claim matches personalUserId, which the server uses
 * for session/index room routing. Falls back to sessionJwt if we
 * haven't done a team session exchange (personal org is the default).
 */
export function getPersonalSessionJwt(): string | null {
  return authState.personalSessionJwt || authState.sessionJwt;
}

/**
 * Refresh the personal-org-scoped JWT via auth Worker refresh token rotation.
 * Called by SyncManager to keep the personal JWT fresh for session sync.
 */
export async function refreshPersonalSession(serverUrl: string): Promise<boolean> {
  try {
    const refreshed = await refreshSession(serverUrl);
    if (refreshed && authState.sessionJwt) {
      authState = { ...authState, personalSessionJwt: authState.sessionJwt };
    }
    return refreshed;
  } catch (error) {
    if ((error as any)?.isNetworkError) {
      logger.main.warn('[StytchAuthService] Network error refreshing personal session - will retry later');
      return false;
    }
    logger.main.error('[StytchAuthService] Error refreshing personal session:', error);
    return false;
  }
}

/**
 * Get the current session token.
 */
export function getSessionToken(): string | null {
  return authState.sessionToken;
}

/**
 * Update the persisted legacy session token after an org/session exchange.
 * Session exchanges (e.g., org switch) replace the session token -- the old
 * one becomes invalid. This function saves the new token so that future
 * refreshSession() calls use the valid token.
 */
export function updateSessionToken(newSessionToken: string): void {
  authState = { ...authState, sessionToken: newSessionToken };
  // Persist to disk so the token survives app restarts
  const creds = loadStytchCredentials();
  if (creds) {
    saveStytchCredentials({ ...creds, sessionToken: newSessionToken });
  }
  // Update accounts map
  if (authState.personalOrgId) {
    updateAccountCredentials(authState.personalOrgId, { sessionToken: newSessionToken });
  }
  // logger.main.info('[StytchAuthService] Session token updated after exchange');
}

/**
 * Start Google OAuth sign-in flow.
 * Opens the auth Worker's Google OAuth URL in the browser.
 * The server handles the callback and redirects to nimbalyst://auth/callback
 */
export async function signInWithGoogle(serverUrl?: string): Promise<{ success: boolean; error?: string }> {
  if (!authWorkerConfig) {
    return { success: false, error: 'Auth not initialized' };
  }

  try {
    const oauthUrl = `${normalizeAuthWorkerBaseUrl(serverUrl)}/auth/google/start?return_to=${encodeURIComponent(AUTH_CALLBACK_BASE_URL)}`;

    // Open in default browser
    await shell.openExternal(oauthUrl);

    logger.main.info('[StytchAuthService] Opened Google OAuth flow via auth worker:', oauthUrl);

    // TODO(phase1.5): The auth Worker owns Google completion and must redirect to
    // nimbalyst://auth/callback?session_token=...&session_jwt=...&user_id=...&email=...&org_id=...
    return { success: true };
  } catch (error) {
    logger.main.error('[StytchAuthService] Google OAuth error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Start email magic-link authentication.
 */
export async function signInWithEmail(
  email: string,
  serverUrl?: string
): Promise<{ success: boolean; error?: string; devToken?: string }> {
  if (!authWorkerConfig) {
    return { success: false, error: 'Auth not initialized' };
  }

  try {
    const data = await postAuthWorker<AuthWorkerEmailStartResponse>('/auth/email/start', { email }, serverUrl);
    if (data.ok === false) {
      return { success: false, error: data.error || 'Email sign-in failed' };
    }

    logger.main.info('[StytchAuthService] Email sign-in started for:', email);
    return { success: true, devToken: data.devToken };
  } catch (error) {
    logger.main.error('[StytchAuthService] Email sign-in error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Verify an email magic-link token and persist the resulting auth-worker session.
 */
export async function verifyEmailToken(
  email: string,
  token: string,
  serverUrl?: string
): Promise<{ success: boolean; error?: string; callbackUrl?: string }> {
  if (!authWorkerConfig) {
    return { success: false, error: 'Auth not initialized' };
  }

  try {
    const data = await postAuthWorker<AuthWorkerSessionResponse>('/auth/email/verify', { email, token }, serverUrl);
    if (!data.sessionJwt || !data.userId || !data.orgId || !data.email) {
      return { success: false, error: 'Auth worker verify response missing required session fields' };
    }

    const callbackUrl = buildAuthCallbackUrl({
      sessionJwt: data.sessionJwt,
      userId: data.userId,
      email: data.email,
      orgId: data.orgId,
    });

    await persistAuthCallback({
      sessionToken: data.sessionJwt,
      sessionJwt: data.sessionJwt,
      refreshToken: data.refreshToken,
      userId: data.userId,
      email: data.email,
      orgId: data.orgId,
    });

    return { success: true, callbackUrl };
  } catch (error) {
    logger.main.error('[StytchAuthService] Email verification error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send a magic link to the user's email for passwordless authentication.
 */
export async function sendMagicLink(
  email: string,
  serverUrl?: string
): Promise<{ success: boolean; error?: string }> {
  return signInWithEmail(email, serverUrl);
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  // Clear local state
  clearStytchCredentials();
  accounts.clear();
  primaryAccountId = null;
  saveAllAccounts();
  updateAuthState({
    isAuthenticated: false,
    user: null,
    session: null,
    sessionToken: null,
    sessionJwt: null,
    orgId: null,
    personalOrgId: null,
    personalUserId: null,
    personalSessionJwt: null,
  });

  logger.main.info('[StytchAuthService] User signed out');
}

/**
 * Sign out a specific account by its personalOrgId.
 * If the primary account is removed and other accounts exist,
 * the next account becomes primary.
 */
export async function removeAccount(targetOrgId: string): Promise<void> {
  accounts.delete(targetOrgId);

  if (primaryAccountId === targetOrgId) {
    // Primary was removed -- pick another or go unauthenticated
    const remaining = Array.from(accounts.keys());
    if (remaining.length > 0) {
      primaryAccountId = remaining[0];
      const newPrimary = accounts.get(primaryAccountId)!;
      // Update singleton to the new primary
      updateAuthState({
        isAuthenticated: true,
        user: newPrimary.userId ? {
          user_id: newPrimary.userId,
          emails: newPrimary.email ? [{ email_id: '', email: newPrimary.email, verified: true }] : [],
          created_at: new Date().toISOString(),
          status: 'active',
        } : null,
        session: null,
        sessionToken: newPrimary.sessionToken,
        sessionJwt: newPrimary.sessionJwt || null,
        orgId: newPrimary.orgId || null,
        personalOrgId: newPrimary.personalOrgId || null,
        personalUserId: newPrimary.personalUserId || null,
        personalSessionJwt: newPrimary.sessionJwt || null,
      });
      logger.main.info('[StytchAuthService] Primary account changed to:', newPrimary.email);
    } else {
      primaryAccountId = null;
      updateAuthState({
        isAuthenticated: false,
        user: null,
        session: null,
        sessionToken: null,
        sessionJwt: null,
        orgId: null,
        personalOrgId: null,
        personalUserId: null,
        personalSessionJwt: null,
      });
      clearStytchCredentials();
      logger.main.info('[StytchAuthService] All accounts removed, user signed out');
    }
  }

  saveAllAccounts();
  logger.main.info('[StytchAuthService] Removed account:', targetOrgId);
}

/**
 * Initiate an "Add Account" OAuth flow.
 * Uses the same Google OAuth mechanism as sign-in, but the callback
 * will detect this is a new personalOrgId and store it as a secondary account.
 */
export async function addAccount(serverUrl?: string): Promise<{ success: boolean; error?: string }> {
  // Same as signInWithGoogle -- the differentiation happens in handleAuthCallback
  return signInWithGoogle(serverUrl);
}

/**
 * Delete the user's account and all associated data.
 * Calls the server's /api/account/delete endpoint which cascades
 * deletes across all storage layers.
 * On success, clears local credentials and signs out.
 */
export async function deleteAccount(serverUrl?: string): Promise<{ success: boolean; error?: string }> {
  if (!authState.isAuthenticated || !authState.sessionJwt) {
    return { success: false, error: 'Not authenticated' };
  }

  const syncServerUrl = serverUrl || getSyncServerUrl();
  if (!syncServerUrl) {
    return { success: false, error: 'No server URL configured' };
  }

  // Convert ws:// to http:// for API calls
  const httpUrl = syncServerUrl
    .replace(/^ws:/, 'http:')
    .replace(/^wss:/, 'https:')
    .replace(/\/$/, '');

  try {
    logger.main.info('[StytchAuthService] Deleting account...');

    const response = await fetch(`${httpUrl}/api/account/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.sessionJwt}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      logger.main.error('[StytchAuthService] Account deletion failed:', response.status, errorData.error);
      return { success: false, error: errorData.error || `Server error: ${response.status}` };
    }

    const data = await response.json() as { deleted: boolean };
    logger.main.info('[StytchAuthService] Account deletion response:', data);

    // Clear local state (same as sign out)
    await signOut();

    logger.main.info('[StytchAuthService] Account deleted successfully');
    return { success: true };
  } catch (error) {
    logger.main.error('[StytchAuthService] Account deletion error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * In-flight refresh promise for the primary account.
 *
 * Why: the auth worker rotates refresh tokens. Concurrent callers using the
 * same stored refresh token can stampede into stale-token failures. Single-flight
 * makes concurrent callers share the result of one in-flight call.
 */
let inflightRefreshSession: Promise<boolean> | null = null;

/**
 * Refresh the current session to get a fresh JWT.
 * Calls the auth Worker's /auth/refresh endpoint.
 *
 * Concurrent callers share a single in-flight /auth/refresh request.
 *
 * @param serverUrl - Optional auth Worker URL override used by local/dev settings.
 * @returns true if refresh succeeded, false if session expired or failed
 */
export function refreshSession(serverUrl?: string): Promise<boolean> {
  if (inflightRefreshSession) {
    return inflightRefreshSession;
  }
  inflightRefreshSession = doRefreshSession(serverUrl).finally(() => {
    inflightRefreshSession = null;
  });
  return inflightRefreshSession;
}

async function doRefreshSession(serverUrl?: string): Promise<boolean> {
  const creds = loadStytchCredentials();
  const refreshToken = creds?.refreshToken;
  if (!refreshToken) {
    logger.main.warn('[StytchAuthService] Cannot refresh - no refresh token');
    return false;
  }

  try {
    logger.main.info('[StytchAuthService] Refreshing session via auth worker...');

    let data: AuthWorkerSessionResponse;
    try {
      data = await postAuthWorker<AuthWorkerSessionResponse>('/auth/refresh', { refreshToken }, serverUrl);
    } catch (fetchError) {
      if ((fetchError as any)?.status) {
        logger.main.warn('[StytchAuthService] Session refresh failed:', (fetchError as Error).message);
        return false;
      }
      logger.main.error('[StytchAuthService] Session refresh error:', fetchError);
      const networkError = new Error('Network error during session refresh');
      (networkError as any).isNetworkError = true;
      (networkError as any).cause = fetchError;
      throw networkError;
    }

    if (!data.sessionJwt || data.sessionJwt.split('.').length !== 3) {
      logger.main.error('[StytchAuthService] Refresh returned invalid JWT');
      return false;
    }

    const nextRefreshToken = data.refreshToken || refreshToken;
    const expiresAtMs = Date.now() + (7 * 24 * 60 * 60 * 1000);
    const personalOrgId = authState.personalOrgId || creds.personalOrgId || data.orgId || null;
    const personalUserId = authState.personalUserId || creds.personalUserId || decodeJwtSub(data.sessionJwt);
    const userId = data.userId || creds.userId || personalUserId || '';
    const email = data.email || creds.email;
    const orgId = data.orgId || authState.orgId || creds.orgId || personalOrgId || null;

    updateAuthState({
      isAuthenticated: true,
      user: userId ? {
        user_id: userId,
        emails: email ? [{ email_id: '', email, verified: true }] : [],
        created_at: new Date().toISOString(),
        status: 'active',
      } : authState.user,
      sessionToken: data.sessionJwt,
      sessionJwt: data.sessionJwt,
      orgId,
      personalOrgId,
      personalUserId,
      personalSessionJwt: data.sessionJwt,
    });

    const refreshedCreds: StoredStytchCredentials = {
      sessionToken: data.sessionJwt,
      sessionJwt: data.sessionJwt,
      refreshToken: nextRefreshToken,
      userId,
      email,
      expiresAt: expiresAtMs,
      orgId: orgId || undefined,
      personalOrgId: personalOrgId || undefined,
      personalUserId: personalUserId || undefined,
    };
    saveStytchCredentials(refreshedCreds);

    if (personalOrgId) {
      accounts.set(personalOrgId, refreshedCreds);
      saveAllAccounts();
    }

    logger.main.info('[StytchAuthService] Session refreshed successfully');
    return true;
  } catch (error) {
    if ((error as any)?.isNetworkError) {
      throw error;
    }
    logger.main.error('[StytchAuthService] Session refresh error:', error);
    return false;
  }
}

/**
 * In-flight refresh promises for secondary accounts, keyed by personalOrgId.
 *
 * Why: Same single-flight rationale as inflightRefreshSession, but per-account.
 * Each account's refresh token is rotated by the auth Worker; concurrent
 * callers for the same account share one request.
 */
const inflightRefreshForAccount = new Map<string, Promise<string | null>>();

/**
 * Refresh a specific account's session by personalOrgId.
 * Works for both primary and secondary accounts.
 * Returns the fresh JWT on success, null on failure.
 *
 * Concurrent callers for the same personalOrgId share a single in-flight refresh.
 */
export function refreshSessionForAccount(personalOrgId: string): Promise<string | null> {
  const inflight = inflightRefreshForAccount.get(personalOrgId);
  if (inflight) {
    return inflight;
  }
  const promise = doRefreshSessionForAccount(personalOrgId).finally(() => {
    inflightRefreshForAccount.delete(personalOrgId);
  });
  inflightRefreshForAccount.set(personalOrgId, promise);
  return promise;
}

async function doRefreshSessionForAccount(personalOrgId: string): Promise<string | null> {
  // For primary account, delegate to refreshSession which updates global authState
  if (personalOrgId === primaryAccountId) {
    try {
      const ok = await refreshSession();
      return ok ? (authState.sessionJwt ?? null) : null;
    } catch {
      return null; // Network error -- return null, don't propagate
    }
  }

  const creds = accounts.get(personalOrgId);
  const refreshToken = creds?.refreshToken;
  if (!refreshToken) {
    logger.main.warn(`[StytchAuthService] Cannot refresh account ${personalOrgId} - no refresh token`);
    return null;
  }

  try {
    logger.main.info(`[StytchAuthService] Refreshing secondary account session for ${personalOrgId}...`);

    const data = await postAuthWorker<AuthWorkerSessionResponse>('/auth/refresh', { refreshToken });
    if (!data.sessionJwt || data.sessionJwt.split('.').length !== 3) {
      logger.main.error(`[StytchAuthService] Secondary account refresh returned invalid JWT for ${personalOrgId}`);
      return null;
    }

    updateAccountCredentials(personalOrgId, {
      sessionToken: data.sessionJwt,
      sessionJwt: data.sessionJwt,
      refreshToken: data.refreshToken || refreshToken,
      userId: data.userId || creds.userId,
      email: data.email || creds.email,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
    });

    logger.main.info(`[StytchAuthService] Secondary account session refreshed for ${personalOrgId}`);
    return data.sessionJwt;
  } catch (error) {
    logger.main.error(`[StytchAuthService] Secondary account refresh error for ${personalOrgId}:`, error);
    return null;
  }
}

function getSyncServerUrl(): string {
  const config = getSessionSyncConfig();
  if (config?.serverUrl) return config.serverUrl;
  return normalizeAuthWorkerBaseUrl();
}

/**
 * Validate the current session against the server and sign out if dead.
 * Always calls refreshSession() to verify the session is alive server-side,
 * not just locally valid. Signs out on confirmed auth failure (expired creds,
 * server rejection) but NOT on network errors -- the session may still be
 * valid once connectivity is restored.
 */
export async function validateAndRefreshSession(): Promise<boolean> {
  const creds = loadStytchCredentials();
  if (!creds || creds.expiresAt <= Date.now()) {
    await signOut();
    return false;
  }

  try {
    const refreshed = await refreshSession();
    if (!refreshed) {
      // Server responded but rejected the session (401/403/expired) -- sign out
      logger.main.warn('[StytchAuthService] Session validation failed - signing out');
      await signOut();
      return false;
    }
    return true;
  } catch (error) {
    if ((error as any)?.isNetworkError) {
      // Network error (ERR_INTERNET_DISCONNECTED, DNS failure, etc.) -- the session
      // may still be valid, we just can't reach the server. Don't nuke credentials;
      // they'll be refreshed automatically once connectivity returns.
      logger.main.warn('[StytchAuthService] Session refresh failed due to network error - keeping credentials');
      return false;
    }
    // Unexpected error -- don't sign out, could be transient
    logger.main.error('[StytchAuthService] Unexpected error during session validation:', error);
    return false;
  }
}

/**
 * Shutdown the auth service.
 * Call this when the app is closing.
 */
export function shutdownStytchAuth(): void {
  // Nothing to clean up - auth state is stored locally and refreshed via the auth Worker.
}

/**
 * Switch auth environment.
 */
export async function switchStytchEnvironment(_environment: 'development' | 'production'): Promise<void> {
  await signOut();
  logger.main.info('[StytchAuthService] Auth environment switched; local session cleared.');
}
