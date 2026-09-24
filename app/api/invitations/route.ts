import { authorize, database, failure, HttpError } from "@/lib/server";
import { isAddress, getAddress } from "viem";

/**
 * Authenticated shareable invitations for agreement roles.
 *
 * Lets a participant generate a secure share link for an agreement role.
 * Counterparties inspect full agreement terms before claiming their role.
 */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) throw new HttpError(400, "Invitation token is required.");

    const db = database();
    const inv = await db
      .prepare(
        "SELECT i.token, i.agreement_id, i.role, i.target_tag, i.expires_at, i.status, " +
          "a.title, a.scope, a.payer_address, a.worker_address, a.verifier_address " +
          "FROM agreement_invitations i " +
          "JOIN live_agreements a ON i.agreement_id = a.id " +
          "WHERE i.token = ?",
      )
      .bind(token)
      .first<{
        token: string;
        agreement_id: string;
        role: string;
        target_tag: string | null;
        expires_at: string;
        status: string;
        title: string;
        scope: string;
        payer_address: string;
        worker_address: string;
        verifier_address: string;
      }>();

    if (!inv) throw new HttpError(404, "Invitation not found or expired.");

    return Response.json({
      invitation: {
        token: inv.token,
        agreementId: inv.agreement_id,
        role: inv.role,
        targetTag: inv.target_tag,
        expiresAt: inv.expires_at,
        status: inv.status,
        title: inv.title,
        scope: inv.scope,
        payerAddress: inv.payer_address,
        workerAddress: inv.worker_address,
        verifierAddress: inv.verifier_address,
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await authorize(request);
    const body = (await request.json()) as {
      agreementId?: string;
      role?: string;
      targetTag?: string;
      days?: number;
    };

    if (!body.agreementId?.trim())
      throw new HttpError(400, "agreementId is required.");
    const role = body.role?.trim().toLowerCase();
    if (!role || !["worker", "verifier"].includes(role))
      throw new HttpError(400, "Valid role (worker, verifier) is required.");

    const db = database();
    const agreement = await db
      .prepare("SELECT id, owner FROM live_agreements WHERE id = ?")
      .bind(body.agreementId)
      .first<{ id: string; owner: string }>();

    if (!agreement) throw new HttpError(404, "Agreement not found.");

    const token = crypto.randomUUID().replace(/-/g, "");
    const days = Math.min(Math.max(body.days ?? 7, 1), 30);
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

    await db
      .prepare(
        "INSERT INTO agreement_invitations(token, agreement_id, role, target_tag, expires_at, status, created_at) " +
          "VALUES(?, ?, ?, ?, ?, 'pending', ?)",
      )
      .bind(
        token,
        body.agreementId,
        role,
        body.targetTag?.trim() ?? null,
        expiresAt,
        new Date().toISOString(),
      )
      .run();

    return Response.json({ token, expiresAt, role }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const owner = await authorize(request);
    const body = (await request.json()) as {
      token?: string;
      claimedAddress?: string;
    };

    if (!body.token?.trim())
      throw new HttpError(400, "token is required.");
    if (!body.claimedAddress || !isAddress(body.claimedAddress))
      throw new HttpError(400, "Valid claimedAddress is required.");

    const address = getAddress(body.claimedAddress);
    const db = database();
    const inv = await db
      .prepare("SELECT token, agreement_id, status, expires_at FROM agreement_invitations WHERE token = ?")
      .bind(body.token)
      .first<{ token: string; agreement_id: string; status: string; expires_at: string }>();

    if (!inv) throw new HttpError(404, "Invitation not found.");
    if (inv.status !== "pending")
      throw new HttpError(400, `Invitation is already ${inv.status}.`);
    if (new Date(inv.expires_at) < new Date())
      throw new HttpError(400, "Invitation has expired.");

    await db
      .prepare(
        "UPDATE agreement_invitations SET status = 'accepted', claimed_by = ? WHERE token = ?",
      )
      .bind(address, body.token)
      .run();

    return Response.json({ success: true, agreementId: inv.agreement_id });
  } catch (error) {
    return failure(error);
  }
}
