import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const AUTH_WORKER_BASE_URL = 'https://auth-dev.smartypants.ai';
const LOCAL_AUTH_WORKER_BASE_URL = 'http://localhost:8790';

const electronMock = vi.hoisted(() => {
  const state = {
    userDataPath: '',
    getPath: vi.fn((_name: string) => state.userDataPath),
    openExternal: vi.fn(),
  };
  return state;
});

const storeMock = vi.hoisted(() => ({
  getSessionSyncConfig: vi.fn(),
  setSessionSyncConfig: vi.fn(),
}));

const analyticsMock = vi.hoisted(() => ({
  sendEvent: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: electronMock.getPath,
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
    decryptString: vi.fn((value: Buffer) => value.toString('utf8')),
  },
  shell: {
    openExternal: electronMock.openExternal,
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    main: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

vi.mock('../../utils/store', () => ({
  getSessionSyncConfig: storeMock.getSessionSyncConfig,
  setSessionSyncConfig: storeMock.setSessionSyncConfig,
}));

vi.mock('../analytics/AnalyticsService', () => ({
  AnalyticsService: {
    getInstance: () => analyticsMock,
  },
}));

import * as Auth from '../StytchAuthService';

function makeJwt(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.signature`;
}

describe('StytchAuthService auth worker integration', () => {
  let tempDir: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stytch-auth-service-'));
    electronMock.userDataPath = tempDir;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.clearAllMocks();
    storeMock.getSessionSyncConfig.mockReturnValue(undefined);
    await Auth.signOut();
    Auth.initializeStytchAuth({
      projectId: 'test-project',
      publicToken: 'unused',
      apiBase: AUTH_WORKER_BASE_URL,
    });
  });

  afterEach(async () => {
    await Auth.signOut();
    vi.unstubAllGlobals();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('signInWithEmail(email) calls POST /auth/email/start with {email}', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, devToken: 'dev-token-123' }), { status: 200 }));

    const result = await Auth.signInWithEmail('paul@example.com');

    expect(result).toEqual({ success: true, devToken: 'dev-token-123' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${AUTH_WORKER_BASE_URL}/auth/email/start`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'paul@example.com' }),
      }),
    );
  });

  it('signInWithEmail(email, serverUrl) uses the provided auth worker URL', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, devToken: 'dev-token-123' }), { status: 200 }));

    const result = await Auth.signInWithEmail('paul@example.com', `${LOCAL_AUTH_WORKER_BASE_URL}/`);

    expect(result).toEqual({ success: true, devToken: 'dev-token-123' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${LOCAL_AUTH_WORKER_BASE_URL}/auth/email/start`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'paul@example.com' }),
      }),
    );
  });

  it('signInWithGoogle(serverUrl) opens the provided auth worker URL', async () => {
    const result = await Auth.signInWithGoogle(LOCAL_AUTH_WORKER_BASE_URL);

    expect(result).toEqual({ success: true });
    expect(electronMock.openExternal).toHaveBeenCalledWith(
      `${LOCAL_AUTH_WORKER_BASE_URL}/auth/google/start?return_to=${encodeURIComponent('nimbalyst://auth/callback')}`,
    );
  });

  it('verifyEmailToken(email, token) calls POST /auth/email/verify and returns the deep-link callback URL', async () => {
    const sessionJwt = makeJwt('user-123');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      sessionJwt,
      refreshToken: 'refresh-token-123',
      userId: 'user-123',
      orgId: 'org-123',
      email: 'paul@example.com',
    }), { status: 200 }));

    const result = await Auth.verifyEmailToken('paul@example.com', 'token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      `${AUTH_WORKER_BASE_URL}/auth/email/verify`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'paul@example.com', token: 'token-123' }),
      }),
    );
    expect(result).toEqual({
      success: true,
      callbackUrl: `nimbalyst://auth/callback?session_token=${sessionJwt}&session_jwt=${sessionJwt}&user_id=user-123&email=paul%40example.com&org_id=org-123`,
    });
    expect(Auth.getSessionToken()).toBe(sessionJwt);
    expect(Auth.getSessionJwt()).toBe(sessionJwt);
    expect(Auth.getPersonalSessionJwt()).toBe(sessionJwt);
  });

  it('refreshPersonalSession() calls POST /auth/refresh and stores the new tokens', async () => {
    const initialJwt = makeJwt('user-123');
    const refreshedJwt = makeJwt('user-123-refreshed');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      sessionJwt: initialJwt,
      refreshToken: 'refresh-token-1',
      userId: 'user-123',
      orgId: 'org-123',
      email: 'paul@example.com',
    }), { status: 200 }));
    await Auth.verifyEmailToken('paul@example.com', 'token-123');
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      sessionJwt: refreshedJwt,
      refreshToken: 'refresh-token-2',
    }), { status: 200 }));

    const refreshed = await Auth.refreshPersonalSession(LOCAL_AUTH_WORKER_BASE_URL);

    expect(refreshed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${LOCAL_AUTH_WORKER_BASE_URL}/auth/refresh`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'refresh-token-1' }),
      }),
    );
    expect(Auth.getSessionToken()).toBe(refreshedJwt);
    expect(Auth.getSessionJwt()).toBe(refreshedJwt);
    expect(Auth.getPersonalSessionJwt()).toBe(refreshedJwt);
  });

  it('resolvePersonalUserId() decodes the JWT payload sub claim correctly', async () => {
    const sessionJwt = makeJwt('personal-user-123');
    await Auth.handleAuthCallback({
      sessionToken: sessionJwt,
      sessionJwt,
      email: 'paul@example.com',
      orgId: 'org-123',
    });

    const resolved = await Auth.resolvePersonalUserId('ignored-server-url');

    expect(resolved).toBe('personal-user-123');
    expect(Auth.getPersonalUserId()).toBe('personal-user-123');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
