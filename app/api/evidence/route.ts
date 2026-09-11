import { authorize, database, bucket, failure, HttpError } from "@/lib/server";
import { sha256 } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    const owner = await authorize(request);
    const form = await request.formData();
    const file = form.get("file");
    const agreementId = form.get("agreementId");
    if (!(file instanceof File) || typeof agreementId !== "string")
      throw new HttpError(400, "Choose a file and agreement.");
    if (file.size === 0 || file.size > 10 * 1024 * 1024)
      throw new HttpError(400, "File must be between 1 byte and 10 MB.");
    if (
      !["image/jpeg", "image/png", "application/pdf", "text/plain"].includes(
        file.type,
      )
    )
      throw new HttpError(400, "Use JPG, PNG, PDF, or text files.");
    const agreement = await database()
      .prepare("SELECT id FROM agreements WHERE id=? AND owner=?")
      .bind(agreementId, owner)
      .first();
    if (!agreement) throw new HttpError(404, "Agreement not found.");
    const count = await database()
      .prepare(
        "SELECT count(*) as n FROM evidence_files WHERE owner=? AND agreement_id=?",
      )
      .bind(owner, agreementId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 60)
      throw new HttpError(
        429,
        "This agreement has reached its 60-file sandbox limit.",
      );
    const bytes = await file.arrayBuffer();
    const digest = await sha256(bytes);
    const id = crypto.randomUUID();
    await bucket().put(id, bytes, { httpMetadata: { contentType: file.type } });
    try {
      await database()
        .prepare(
          "INSERT INTO evidence_files(id,owner,agreement_id,name,mime,digest,size,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          owner,
          agreementId,
          file.name.slice(0, 200),
          file.type,
          digest,
          file.size,
          new Date().toISOString(),
        )
        .run();
    } catch (error) {
      await bucket().delete(id);
      throw error;
    }
    return Response.json({ id, name: file.name, digest });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    const owner = await authorize();
    const id = new URL(request.url).searchParams.get("id");
    const file = await database()
      .prepare("SELECT name,mime FROM evidence_files WHERE id=? AND owner=?")
      .bind(id, owner)
      .first<{ name: string; mime: string }>();
    if (!file) throw new HttpError(404, "Evidence not found.");
    const object = await bucket().get(id!);
    if (!object) throw new HttpError(404, "Evidence is unavailable.");
    return new Response(object.body, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
