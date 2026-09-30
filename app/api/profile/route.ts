import { loadProfile } from "@/lib/profile";
import { failure, HttpError } from "@/lib/server";

/**
 * Public verified-work profile, by @name or address. No sign-in: it only
 * repeats what the chain already makes public. Cached briefly, since every
 * request reads the chain for each job.
 */
export async function GET(request: Request) {
  try {
    const handle = new URL(request.url).searchParams.get("handle")?.trim() ?? "";
    if (!/^@?[a-z0-9_]{3,32}$/i.test(handle) && !/^0x[a-fA-F0-9]{40}$/.test(handle))
      throw new HttpError(400, "Ask for an @name or an address.");
    const profile = await loadProfile(handle);
    if (!profile) throw new HttpError(404, "Nobody on Accrue goes by that name.");
    return Response.json({ profile }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return failure(error);
  }
}
