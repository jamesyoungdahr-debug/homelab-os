import { z } from "zod";

// Each accessor validates only the vars its own caller needs, so a missing
// Radarr API key (say) throws only when the Radarr route is hit — it doesn't
// take down Sonarr/Prowlarr/system routes too. See lib/arr/*.ts and
// app/api/*/route.ts for callers.

function readOrThrow<T extends z.ZodTypeAny>(schema: T, values: Record<string, string | undefined>): z.infer<T> {
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing/invalid environment variables: ${missing}`);
  }
  return parsed.data;
}

const serviceSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().min(1),
});

export function sonarrEnv() {
  return readOrThrow(serviceSchema, { url: process.env.SONARR_URL, apiKey: process.env.SONARR_API_KEY });
}

export function radarrEnv() {
  return readOrThrow(serviceSchema, { url: process.env.RADARR_URL, apiKey: process.env.RADARR_API_KEY });
}

export function prowlarrEnv() {
  return readOrThrow(serviceSchema, { url: process.env.PROWLARR_URL, apiKey: process.env.PROWLARR_API_KEY });
}

export function diskMountPath() {
  return process.env.DISK_MOUNT_PATH ?? (process.platform === "win32" ? "C:" : "/");
}

const authEnvSchema = z.object({
  // Container-reachable base (e.g. http://authentik-server:9000/application/o/<slug>/).
  // Authentik's discovery document mirrors whatever host it was requested
  // on for EVERY endpoint it returns, so this is used for discovery, token,
  // userinfo, and jwks — all of which are called server-to-server and need
  // an address only the dashboard's own container can reach.
  issuer: z.string().url(),
  // Browser-reachable base origin (e.g. http://<server-lan-ip>:9000) — the
  // one endpoint that must NOT come from discovery-via-internal-issuer is
  // the authorization endpoint, since the user's browser (not the
  // container) navigates there directly. See auth.ts.
  publicUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  secret: z.string().min(1, "NEXTAUTH_SECRET is required"),
});

export function authentikEnv() {
  return readOrThrow(authEnvSchema, {
    issuer: process.env.AUTHENTIK_ISSUER,
    publicUrl: process.env.AUTHENTIK_PUBLIC_URL,
    clientId: process.env.AUTHENTIK_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
    secret: process.env.NEXTAUTH_SECRET,
  });
}
