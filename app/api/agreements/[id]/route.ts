import { authorize, database, failure, HttpError } from "@/lib/server";
import { applyAction, type Agreement } from "@/lib/domain";
import { actionSchema, sha256 } from "@/lib/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await authorize(request);
    const { id } = await params;
    const action = actionSchema.parse(await request.json());
    const row = await database()
      .prepare(
        "SELECT data, version FROM agreements WHERE id = ? AND owner = ?",
      )
      .bind(id, owner)
      .first<{ data: string; version: number }>();
    if (!row) throw new HttpError(404, "Agreement not found.");
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
        const file = await database()
          .prepare(
            "SELECT id,digest,name FROM evidence_files WHERE id=? AND owner=? AND agreement_id=?",
          )
          .bind(fileId, owner, id)
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
        "UPDATE agreements SET data=?, version=? WHERE id=? AND owner=? AND version=?",
      )
      .bind(JSON.stringify(next), next.version, id, owner, row.version)
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
