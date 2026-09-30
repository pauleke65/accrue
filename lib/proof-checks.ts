import {
  type ApiManifest,
  type ApiPolicy,
  type DigitalManifest,
  type DigitalPolicy,
  type PullRequestPolicy,
  type WebpagePolicy,
  assertManifestFits,
  deliverableKind,
  deploymentProbeUrl,
  webpageManifestSchema,
} from "./digital-work-policy.ts";

/**
 * Proof Engine's deterministic checks: the part of a review that is a fact,
 * not a judgement. Kept free of Worker-only imports so the checks run under
 * node --test with a stubbed fetch.
 */

/**
 * GitHub allows 60 unauthenticated requests an hour per IP, and Workers share
 * egress IPs. A token (set by the verify route from ACCRUE_GITHUB_TOKEN)
 * lifts that; without one a rate limit is reported as an error, which makes
 * the engine abstain rather than vote fail.
 */
let githubToken: string | null = null;
export function setGithubToken(token: string | null | undefined): void {
  githubToken = token?.trim() || null;
}
function githubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "Accrue-Proof-Engine",
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };
}

const MAX_RESPONSE_BYTES = 32_768;
const MAX_PAGE_BYTES = 524_288;


/** One pass/fail line in a report, whatever the deliverable type. */
export type CheckItem = { label: string; passed: boolean; detail: string };

export type ApiCheckReport = {
  commitUrl: string;
  commitFound: boolean;
  probeUrl: string;
  responseStatus: number | null;
  expectedStatus: number;
  jsonKey: string;
  expectedValue: string;
  actualValue: string | null;
  statusMatches: boolean;
  bodyMatches: boolean;
  error: string | null;
  items?: CheckItem[];
};

export type WebpageCheckReport = {
  kind: "webpage";
  pageUrl: string;
  responseStatus: number | null;
  requiredText: string;
  items: CheckItem[];
  error: string | null;
};

export type PullRequestCheckReport = {
  kind: "pull_request";
  pullRequestUrl: string;
  repository: string;
  merged: boolean;
  items: CheckItem[];
  error: string | null;
};

export type CheckReport = ApiCheckReport | WebpageCheckReport | PullRequestCheckReport;

/** Every check that decides the result, in the shape the report UI shows. */
export function checkItems(report: CheckReport): CheckItem[] {
  if (report.items) return report.items;
  const api = report as ApiCheckReport;
  return [
    { label: "Public commit", passed: api.commitFound, detail: api.commitFound ? "Found on GitHub" : "Not found" },
    { label: "HTTP response", passed: api.statusMatches, detail: `Expected ${api.expectedStatus}, got ${api.responseStatus ?? "no response"}` },
    { label: "JSON result", passed: api.bodyMatches, detail: `${api.jsonKey}: expected ${api.expectedValue}, got ${api.actualValue ?? "nothing"}` },
  ];
}



async function readLimited(response: Response, limit = MAX_RESPONSE_BYTES): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error(`Response exceeded the ${Math.round(limit / 1024)} KB verification limit.`);
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export async function runChecks(
  policy: DigitalPolicy,
  manifest: DigitalManifest,
  fetcher: typeof fetch = fetch,
): Promise<CheckReport> {
  assertManifestFits(policy, manifest);
  const kind = deliverableKind(policy);
  if (kind === "webpage") return runWebpageChecks(policy as WebpagePolicy, manifest as { pageUrl: string }, fetcher);
  if (kind === "pull_request") return runPullRequestChecks(policy as PullRequestPolicy, manifest as { pullRequestUrl: string }, fetcher);
  const report = await runApiChecks(policy as ApiPolicy, manifest as ApiManifest, fetcher);
  return { ...report, items: checkItems(report) };
}

/** Collapses markup to readable text so a phrase split by tags still matches. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ")
    // Text a visitor can't see doesn't count: hidden elements are dropped.
    .replace(/<(\w+)[^>]*(\shidden[\s>=]|aria-hidden="true"|display\s*:\s*none|visibility\s*:\s*hidden)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function runWebpageChecks(
  policy: WebpagePolicy,
  manifest: { pageUrl: string },
  fetcher: typeof fetch = fetch,
): Promise<WebpageCheckReport> {
  const report: WebpageCheckReport = {
    kind: "webpage", pageUrl: manifest.pageUrl, responseStatus: null, requiredText: policy.requiredText, items: [], error: null,
  };
  let loaded = false;
  let contains = false;
  let onHost = !policy.pageHost;
  try {
    // Follow redirects by hand so every hop is re-checked as a public HTTPS
    // address; an automatic follow could land anywhere.
    let url = manifest.pageUrl;
    let response = await fetcher(url, { headers: { Accept: "text/html,text/plain", "User-Agent": "Accrue-Proof-Engine" }, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    for (let hop = 0; hop < 3 && response.status >= 300 && response.status < 400; hop++) {
      const next = new URL(response.headers.get("location") ?? "", url).toString();
      webpageManifestSchema.shape.pageUrl.parse(next);
      await response.body?.cancel();
      url = next;
      response = await fetcher(url, { headers: { Accept: "text/html,text/plain", "User-Agent": "Accrue-Proof-Engine" }, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    }
    report.responseStatus = response.status;
    const host = new URL(url).hostname.toLowerCase();
    onHost = !policy.pageHost || host === policy.pageHost || host.endsWith(`.${policy.pageHost}`);
    loaded = response.status === 200;
    if (response.status === 429 || response.status >= 500)
      report.error = `The site answered ${response.status}; the page could not be checked.`;
    const text = visibleText(await readLimited(response, MAX_PAGE_BYTES));
    contains = text.includes(policy.requiredText.toLowerCase().replace(/\s+/g, " "));
  } catch (error) {
    report.error = `Could not load the page: ${error instanceof Error ? error.message : "network error"}`;
  }
  report.items = [
    ...(policy.pageHost ? [{ label: "Agreed site", passed: onHost, detail: onHost ? policy.pageHost : `Must be on ${policy.pageHost}` }] : []),
    { label: "Page loads", passed: loaded, detail: report.responseStatus ? `HTTPS, status ${report.responseStatus}` : "No response" },
    { label: "Required text", passed: contains, detail: contains ? `Found "${policy.requiredText}"` : `"${policy.requiredText}" not found on the page` },
  ];
  return report;
}

export async function runPullRequestChecks(
  policy: PullRequestPolicy,
  manifest: { pullRequestUrl: string },
  fetcher: typeof fetch = fetch,
): Promise<PullRequestCheckReport> {
  const [, owner, repo, , number] = new URL(manifest.pullRequestUrl).pathname.split("/");
  const report: PullRequestCheckReport = {
    kind: "pull_request", pullRequestUrl: manifest.pullRequestUrl, repository: policy.repository, merged: false, items: [], error: null,
  };
  let found = false;
  let rightRepo = false;
  let byWorker = !policy.authorLogin;
  let fresh = !policy.openedAfter;
  try {
    const response = await fetcher(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
      headers: githubHeaders(),
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    found = response.status === 200;
    // Rate limits and outages say nothing about the work: report, don't fail.
    if (response.status === 403 || response.status === 429 || response.status >= 500)
      report.error = `GitHub answered ${response.status}; the pull request could not be checked.`;
    if (found) {
      const pull = JSON.parse(await readLimited(response, MAX_PAGE_BYTES)) as {
        merged?: boolean;
        user?: { login?: string };
        created_at?: string;
        base?: { repo?: { full_name?: string } };
      };
      rightRepo = (pull.base?.repo?.full_name ?? "").toLowerCase() === policy.repository.toLowerCase();
      report.merged = pull.merged === true;
      byWorker = !policy.authorLogin || (pull.user?.login ?? "").toLowerCase() === policy.authorLogin.toLowerCase();
      fresh = !policy.openedAfter || (!!pull.created_at && pull.created_at >= policy.openedAfter);
    } else {
      await response.body?.cancel();
    }
  } catch (error) {
    report.error = `Could not check the pull request: ${error instanceof Error ? error.message : "network error"}`;
  }
  report.items = [
    { label: "Pull request", passed: found, detail: found ? "Found on GitHub" : "Not found or not public" },
    { label: "Target repository", passed: rightRepo, detail: rightRepo ? policy.repository : `Must merge into ${policy.repository}` },
    ...(policy.authorLogin ? [{ label: "Opened by the worker", passed: byWorker, detail: byWorker ? `@${policy.authorLogin} on GitHub` : `Must be opened by @${policy.authorLogin}` }] : []),
    ...(policy.openedAfter ? [{ label: "Opened for this job", passed: fresh, detail: fresh ? "After the job was posted" : "Opened before the job existed" }] : []),
    { label: "Merged", passed: report.merged, detail: report.merged ? "Merged by a maintainer" : "Not merged yet" },
  ];
  return report;
}

export async function runApiChecks(
  policy: ApiPolicy,
  manifest: ApiManifest,
  fetcher: typeof fetch = fetch,
): Promise<ApiCheckReport> {
  const commitUrl = new URL(manifest.commitUrl);
  const apiCommitUrl = `https://api.github.com/repos${commitUrl.pathname.replace("/commit/", "/commits/")}`;
  const probeUrl = deploymentProbeUrl(policy, manifest);
  const report: ApiCheckReport = {
    commitUrl: manifest.commitUrl,
    commitFound: false,
    probeUrl,
    responseStatus: null,
    expectedStatus: policy.expectedStatus,
    jsonKey: policy.expectedJsonKey,
    expectedValue: policy.expectedJsonValue,
    actualValue: null,
    statusMatches: false,
    bodyMatches: false,
    error: null,
  };

  try {
    const commit = await fetcher(apiCommitUrl, {
      headers: githubHeaders(),
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    report.commitFound = commit.status === 200;
    await commit.body?.cancel();
  } catch (error) {
    report.error = `Could not check the public commit: ${error instanceof Error ? error.message : "network error"}`;
  }

  try {
    const response = await fetcher(probeUrl, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    report.responseStatus = response.status;
    report.statusMatches = response.status === policy.expectedStatus;
    const body = JSON.parse(await readLimited(response)) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const field = (body as Record<string, unknown>)[policy.expectedJsonKey];
      report.actualValue = field == null ? null : String(field);
      report.bodyMatches = report.actualValue === policy.expectedJsonValue;
    }
  } catch (error) {
    report.error = `Could not verify the deployed endpoint: ${error instanceof Error ? error.message : "network error"}`;
  }
  return report;
}

