# Keycloak, ordinary sign-in, and stolen tokens in this project

Reviewed on 3 October 2026. This is a source-code review, not a live audit of the Keycloak realm configuration. The frontend redesign does not fix the backend security gaps below.

## What Keycloak does

Keycloak is a central identity server. Your website still has a normal sign-in experience, but Keycloak handles authentication and can share that login across multiple applications. OpenID Connect (OIDC) describes how your application learns who signed in; OAuth 2.0 provides the underlying authorization flows.

The recommended browser flow is:

1. The app redirects the browser to Keycloak with an authorization request, including state and a PKCE challenge.
2. The user signs in at Keycloak. Password policies, MFA, and configured external identity providers apply there.
3. Keycloak redirects back with a short-lived, single-use authorization code.
4. The app exchanges the code plus its PKCE verifier for tokens.
5. The app sends an access token to FastAPI as `Authorization: Bearer ...`.
6. FastAPI validates the token and enforces ownership of each todo. Authentication alone is not permission to read another user's tasks.

The access token authorizes API calls. A refresh token obtains replacement access tokens. An ID token describes the login for the client and should not be used as an API access token. A cookie is just a browser storage/transport mechanism: it can contain a random session ID or a JWT. “Cookie versus JWT” and “Keycloak versus local login” are different decisions.

## Why use it?

| Question | Keycloak | App-managed login |
| --- | --- | --- |
| Several apps share one login | Built for SSO | Requires a shared identity/session design |
| MFA, identity federation, account policies | Central features to configure | Your app/team implements or integrates them |
| User administration | One central identity system | Usually managed separately for each app |
| Infrastructure | Another service, database, upgrades, backups, monitoring | Fewer services for a small app |
| Integration | OIDC clients, redirects, keys, token lifecycle | Password hashing, recovery, sessions, revocation |
| Availability | New logins/refresh depend on Keycloak | Depends on your own auth service/database |
| Stolen credentials/tokens | Still requires theft prevention and revocation design | Also requires theft prevention and revocation design |

For several homelab apps or an organization, Keycloak is useful. For a single small todo website, well-implemented server sessions may be simpler. Keycloak can also authenticate users for an application that then issues its own server-side session cookie.

## Your stolen-token example: yes, this can happen

Suppose an access token expires at 10:05. Someone copies it at 10:01 and you log out at 10:02. If FastAPI only checks the signature and expiration, the copied token can still work until 10:05. Removing your browser's token does not remove the attacker's copy. Ending the Keycloak session normally prevents further refresh through that session, but does not make an offline JWT verifier aware of logout.

A random, server-side session cookie is different: the server can reject the copied session ID after the underlying session is revoked. HttpOnly prevents ordinary page JavaScript from reading the cookie; it does not make a stolen cookie unusable. Secure limits transmission to HTTPS. SameSite helps with CSRF, and state-changing cookie-authenticated routes still need an appropriate CSRF strategy.

## What the project currently does

- `frontend/src/lib/api.ts` builds a hosted authorization-code redirect and also supports the password grant. The custom redirect currently has neither state verification nor PKCE. The installed `keycloak-js` dependency is not used by the active sign-in flow. Prefer its supported code flow with PKCE rather than maintaining a custom OAuth implementation.
- `frontend/src/store/useAppStore.ts` persists Keycloak access tokens in localStorage. XSS can read those tokens. It discards refresh tokens in the active store and has no automatic refresh lifecycle. The old, unused `AuthContext.tsx` separately stores access and refresh tokens; it is not the active page's authentication system.
- `backend/app/core/keycloak.py` verifies the RS256 signature and expiration on an uncached request, but explicitly disables issuer and audience validation and does not require an expiration claim. Production verification needs the expected issuer, API audience, required claims, and correct realm/client configuration.
- `backend/app/api/dependencies.py` returns cached user data before verifying the JWT. The cache lives for a fixed 300 seconds, independent of token expiration. A token first cached just before expiry can remain accepted for almost five extra minutes. The cache key uses only the last 32 characters of the token; use a cryptographic digest of the complete token instead. Cached user status also delays account-disable checks.
- `backend/app/api/v1/routes/auth.py` logs out database sessions and clears their cookie. It does not end Keycloak SSO, revoke Keycloak refresh tokens, or denylist Keycloak JWTs. The `/logout-all` endpoint likewise applies to the application's database sessions, not all Keycloak sessions.
- `backend/app/repositories/session_repository.py` revokes direct sessions in PostgreSQL and evicts Redis entries. Normally a stolen direct-session cookie then stops working. Cache eviction failures are swallowed, and cached sessions bypass database revocation and expiry checks for up to the remaining 300-second cache lifetime. Concurrent cache fills can also race with revocation. Immediate revocation needs a stronger consistency design.
- Direct login returns `{ session_token, user, expires_at }` and sets an HttpOnly cookie. The frontend now uses cookie authentication, verifies `/auth/me` after login, and no longer persists the direct session secret as a JWT. The backend still exposes the same session secret in the JSON response; a cookie-only design should stop returning it.

## Recommended security work, in priority order

1. Correct server validation: enforce expiry on every JWT request, require relevant claims, validate issuer/audience, and ensure no cache outlives expiry or bypasses revocation/account status policy. Treat the database/session authority as authoritative for direct-session revocation.
2. Use hosted authorization code + PKCE with state validation, preferably through the existing official adapter. Remove the browser password-grant option for production. Use HTTPS, explicit redirect URIs, and explicit web origins.
3. Implement real Keycloak logout and communicate which sessions it ends. Choose the acceptable access-token revocation delay deliberately.
4. For immediate API rejection, check a server-side session or revocation record on every request, or use appropriate online token introspection with the required confidential-server credentials. A JWT denylist keyed by `jti` addresses a particular token; session-wide revocation needs a session identifier and refresh/session handling. Every accepting API must participate. Revocation caches create a bounded delay and outages need an explicit failure policy.
5. Consider a backend-for-frontend: keep Keycloak tokens on the server and give the browser a Secure, HttpOnly session cookie. Revoke that session on logout, add CSRF protection, and handle upstream refresh/logout on the server. This reduces browser token exposure without eliminating XSS or cookie theft risk.
6. Keep access tokens short-lived as defense in depth; short expiry limits damage but is not immediate revocation. If refresh is introduced, handle rotation/reuse detection and logout consistently.

## Frontend work completed

The active page now has a responsive Daymark design, task counts, search/filtering, create/edit/complete/delete controls, loading/empty/error states, and a top-right notification stack. Notifications are dismissible, announce success/error to assistive technology, and expire automatically. Failed edits preserve the draft. Task controls are disabled while their request runs. Authentication errors are caught rather than becoming unhandled form rejections. Keycloak logout feedback explicitly says that the identity-provider session may remain active.

Validation: `node --test tests/store.test.mjs` from `frontend` exercises cookie auth, task changes/failures, and logout feedback using mocked HTTP responses. It does not verify the live Keycloak realm, Redis, PostgreSQL, or end-to-end identity-provider logout.

## Official references

- [Keycloak JavaScript adapter: code flow, token refresh, memory-only tokens, and PKCE](https://www.keycloak.org/securing-apps/javascript-adapter)
- [Keycloak OIDC endpoints: logout, introspection, and revocation](https://www.keycloak.org/securing-apps/oidc-layers)
- [Keycloak administration: sessions and token timeouts](https://www.keycloak.org/docs/latest/server_admin/)
