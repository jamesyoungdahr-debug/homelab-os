import NextAuth from "next-auth";
import Authentik from "next-auth/providers/authentik";
import { authentikEnv } from "@/lib/env";

// Config is built inside this callback (Auth.js v5's "advanced
// initialization" form) rather than read at module scope. Verified the hard
// way: with a plain `NextAuth({...})` call, `authentikEnv()` ran during
// `next build`'s page-data-collection step (page.tsx imports this module),
// which crashed the Docker build in an environment with no real secrets —
// exactly the case for a CI-built image that only gets real Authentik
// credentials injected at container runtime. This form defers everything
// inside to request time instead.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const { issuer, publicUrl, clientId, clientSecret } = authentikEnv();

  return {
    providers: [
      Authentik({
        // `issuer` (container-reachable) drives discovery, which fills in
        // token/userinfo/jwks with URLs based on THAT same host — verified
        // against a live Authentik 2025.8.6 instance, its discovery document
        // mirrors whatever host it was requested on for every endpoint, with
        // no way to get a mix of internal/public URLs from one discovery
        // call. That's fine for token/userinfo/jwks (server-to-server, the
        // container can reach them) but wrong for `authorization` — the
        // user's BROWSER navigates there directly and can't resolve the
        // internal container hostname, so that one endpoint is overridden
        // below to the browser-reachable address instead of coming from
        // discovery.
        issuer,
        clientId,
        clientSecret,
        authorization: { url: `${publicUrl}/application/o/authorize/` },
      }),
    ],
    session: { strategy: "jwt" },
    secret: process.env.NEXTAUTH_SECRET,
    // Required for self-hosted deployments behind a reverse proxy/Docker
    // network — otherwise Auth.js v5 throws UntrustedHost.
    trustHost: true,
    callbacks: {
      // Without this, `export { auth as proxy }` in proxy.ts only decorates
      // the request with req.auth — it does NOT block unauthenticated
      // requests. This callback is what makes it actually redirect to
      // sign-in. (This is still only an optimistic/cookie-based check per
      // Next.js's own auth guidance — the route handlers additionally verify
      // the session themselves before touching Sonarr/Radarr/Prowlarr/system
      // data.)
      authorized: ({ auth }) => !!auth,
    },
  };
});
