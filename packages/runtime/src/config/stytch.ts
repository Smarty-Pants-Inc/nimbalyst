/**
 * Stytch B2B Configuration
 *
 * These are PUBLIC tokens - safe to commit to git.
 * They are designed to be embedded in client-side code.
 *
 * DO NOT put the secret key here - it should only exist on the server (collabv3).
 */

export const STYTCH_CONFIG = {
  live: {
    projectId: 'project-live-70b810e0-b201-4cf4-b8e8-2b694fd4515f',
    publicToken: 'public-token-live-db5dfb0e-6423-4166-8366-164f4138e0ff',
    apiBase: 'https://api.stytch.com/v1/b2b',
  },
};

/**
 * Get the Stytch config.
 * Client Stytch identifiers are explicit app config only. Do not inherit
 * ambient STYTCH_* env vars from unrelated development shells.
 */
export function getStytchConfig() {
  return STYTCH_CONFIG.live;
}
