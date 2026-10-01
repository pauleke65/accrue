import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

/**
 * Workers AI has no local emulation, so binding it makes Wrangler demand a
 * Cloudflare sign-in before the dev server will start, and a clean clone
 * without one fails at `npm run dev`. Builds always bind it, because the
 * deployed Worker's config is generated from this one. Local development binds
 * it where Wrangler already has credentials, or when ACCRUE_REMOTE_AI=1 asks
 * (ACCRUE_REMOTE_AI=0 skips it). Without it Proof Engine still runs its checks
 * and says the AI review is unavailable, or uses BeatAPI when a key is set.
 */
function wranglerSignedIn(): boolean {
  if (process.env.CLOUDFLARE_API_TOKEN) return true;
  const home = homedir();
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return [
    path.join(home, ".wrangler"),
    path.join(xdgConfig, ".wrangler"),
    path.join(home, "Library", "Preferences", ".wrangler"),
  ].some((dir) => existsSync(path.join(dir, "config", "default.toml")));
}

export default defineConfig(async ({ command }) => {
  const remoteAi =
    command === "build" ||
    (process.env.ACCRUE_REMOTE_AI
      ? process.env.ACCRUE_REMOTE_AI === "1"
      : wranglerSignedIn());

  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          ...localBindingConfig,
          ...(remoteAi ? { ai: { binding: "AI", remote: true } } : {}),
        },
      }),
    ],
  };
});
