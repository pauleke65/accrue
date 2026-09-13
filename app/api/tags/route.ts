import { authorize, database, failure, HttpError } from "@/lib/server";
import { verifyMessage, isAddress, getAddress } from "viem";

/**
 * The payment directory: a tag resolves to an on-chain address so nobody has
 * to read hex to pay someone.
 *
 * A tag is written only after the claimant signs the claim with the account it
 * points at. The server verifies that signature rather than trusting the
 * request, so a tag cannot be pointed at an address its claimant does not
 * control. Resolution is public within the app; claiming is not.
 */

const TAG = /^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$/;

/** The exact text a claimant signs. Binding the address stops replay onto another account. */
export function claimMessage(tag: string, address: string): string {
  return `Accrue: claim the tag @${tag} for ${address}`;
}

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const tag = url.searchParams.get("tag")?.toLowerCase().replace(/^@/, "");
    const address = url.searchParams.get("address");

    if (tag) {
      if (!TAG.test(tag)) throw new HttpError(400, "That is not a valid tag.");
      const row = await database()
        .prepare("SELECT tag, address, display_name FROM tags WHERE tag = ?")
        .bind(tag)
        .first<{ tag: string; address: string; display_name: string }>();
      if (!row) return Response.json({ tag, found: false });
      return Response.json({
        found: true,
        tag: row.tag,
        address: row.address,
        displayName: row.display_name,
      });
    }

    if (address) {
      if (!isAddress(address))
        throw new HttpError(400, "That is not a valid account address.");
      const row = await database()
        .prepare("SELECT tag, display_name FROM tags WHERE address = ?")
        .bind(getAddress(address))
        .first<{ tag: string; display_name: string }>();
      return row
        ? Response.json({
            found: true,
            tag: row.tag,
            displayName: row.display_name,
          })
        : Response.json({ found: false });
    }

    throw new HttpError(400, "Ask for a tag or an address.");
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await authorize(request);
    const body = (await request.json()) as {
      tag?: string;
      address?: string;
      displayName?: string;
      signature?: string;
    };

    const tag = body.tag?.toLowerCase().replace(/^@/, "").trim() ?? "";
    if (!TAG.test(tag))
      throw new HttpError(
        400,
        "Tags are 3 to 20 characters: letters, numbers and underscores, starting and ending with a letter or number.",
      );
    if (!body.address || !isAddress(body.address))
      throw new HttpError(400, "A valid account address is required.");
    if (!body.signature?.startsWith("0x"))
      throw new HttpError(400, "A signature is required to claim a tag.");

    const address = getAddress(body.address);
    const displayName = (body.displayName ?? tag).trim().slice(0, 60) || tag;

    // The claim is only as good as the signature: this proves the claimant
    // holds the key for the address the tag will resolve to.
    const proven = await verifyMessage({
      address,
      message: claimMessage(tag, address),
      signature: body.signature as `0x${string}`,
    });
    if (!proven)
      throw new HttpError(
        403,
        "That signature does not match the account being claimed.",
      );

    const existing = await database()
      .prepare("SELECT address FROM tags WHERE tag = ?")
      .bind(tag)
      .first<{ address: string }>();
    if (existing && existing.address !== address)
      throw new HttpError(409, "That tag is already taken.");

    const held = await database()
      .prepare("SELECT count(*) as n FROM tags WHERE owner = ?")
      .bind(owner)
      .first<{ n: number }>();
    if (!existing && (held?.n ?? 0) >= 12)
      throw new HttpError(429, "This workspace has claimed enough tags.");

    await database()
      .prepare(
        "INSERT INTO tags(tag,address,owner,display_name,created_at) VALUES(?,?,?,?,?)" +
          " ON CONFLICT(tag) DO UPDATE SET address=excluded.address, display_name=excluded.display_name",
      )
      .bind(tag, address, owner, displayName, new Date().toISOString())
      .run();

    return Response.json({ tag, address, displayName }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
