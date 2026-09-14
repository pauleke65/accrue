import { authorize, database, failure, HttpError } from "@/lib/server";
import { applyAction, type Agreement } from "@/lib/domain";
import { actionSchema, sha256 } from "@/lib/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authorize(request);
    const { id } = await params;
    const action = actionSchema.parse(await request.json());
    
    const user = await database()
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind(userId)
      .first<{ email: string }>();
    const email = user?.email || "";

    const row = await database()
      .prepare(
        "SELECT data, version, payer_id as payerId, earner_email as earnerEmail, verifier_email as verifierEmail FROM agreements WHERE id = ? AND (payer_id = ? OR earner_email = ? OR verifier_email = ?)",
      )
      .bind(id, userId, email, email)
      .first<{ data: string; version: number; payerId: string; earnerEmail: string; verifierEmail: string }>();
      
    if (!row) throw new HttpError(404, "Agreement not found or access denied.");
    
    // Verify the user is actually allowed to perform this action under the requested role
    if (action.role === "payer" && row.payerId !== userId)
      throw new HttpError(403, "You are not the payer of this agreement.");
    if (action.role === "earner" && row.earnerEmail !== email)
      throw new HttpError(403, "You are not the earner of this agreement.");
    if (action.role === "verifier" && row.verifierEmail !== email)
      throw new HttpError(403, "You are not the verifier of this agreement.");

    const agreement = JSON.parse(row.data) as Agreement;
    if (agreement.operations.includes(action.operationId))
      return Response.json({ agreement });
    if (row.version !== action.version)
      throw new HttpError(
        409,
        "This agreement changed. Refresh and review it before trying again.",
      );
    if (agreement.timeline.length >= 1000)
      throw new HttpError(429, "Sandbox activity limit reached.");
    if (action.type === "submit") {
      const files = [];
      for (const fileId of action.files ?? []) {
        // Files should be accessible to anyone on the agreement (or specifically the earner uploading them)
        const file = await database()
          .prepare(
            "SELECT id,digest,name FROM evidence_files WHERE id=? AND agreement_id=?",
          )
          .bind(fileId, id)
          .first();
        if (!file)
          throw new HttpError(
            400,
            "An evidence file is unavailable. Upload it again.",
          );
        files.push(file);
      }
      action.digest = await sha256(
        JSON.stringify({
          schema: "accrue-evidence-v1",
          agreement: id,
          milestone: action.milestone,
          notes: action.notes,
          files,
        }),
      );
    }
    let next: Agreement;
    try {
      next = applyAction(agreement, action);
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Invalid action",
      );
    }
    const result = await database()
      .prepare(
        "UPDATE agreements SET data=?, version=?, status=? WHERE id=? AND version=?",
      )
      .bind(JSON.stringify(next), next.version, next.status, id, row.version)
      .run();
    if (result.meta.changes !== 1)
      throw new HttpError(
        409,
        "Another action completed first. Refresh before retrying.",
      );
    return Response.json({ agreement: next });
  } catch (error) {
    return failure(error);
  }
}
