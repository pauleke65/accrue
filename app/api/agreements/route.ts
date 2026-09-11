import { authorize, database, failure, HttpError } from "@/lib/server";
import { createAgreement } from "@/lib/domain";
import { draftSchema } from "@/lib/validation";
export async function GET() {
  try {
    const owner = await authorize();
    const result = await database()
      .prepare(
        "SELECT data FROM agreements WHERE owner = ? ORDER BY rowid DESC LIMIT 100",
      )
      .bind(owner)
      .all<{ data: string }>();
    return Response.json(
      {
        agreements: result.results.map((row) => JSON.parse(row.data)),
        mode: "sandbox",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await authorize(request);
    const raw = await request.json();
    const data = {
      ...draftSchema.parse(raw),
      operationId: (raw as { operationId?: string }).operationId,
    };
    if (!data.operationId || !/^[a-f0-9-]{36}$/.test(data.operationId))
      throw new HttpError(400, "A valid operation identifier is required.");
    const id = data.operationId;
    const existing = await database()
      .prepare("SELECT data FROM agreements WHERE id = ? AND owner = ?")
      .bind(id, owner)
      .first<{ data: string }>();
    if (existing)
      return Response.json({ agreement: JSON.parse(existing.data) });
    const count = await database()
      .prepare("SELECT count(*) as n FROM agreements WHERE owner = ?")
      .bind(owner)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 100)
      throw new HttpError(429, "Sandbox limit: 100 agreements per workspace.");
    const agreement = createAgreement(draftSchema.parse(data), id);
    await database()
      .prepare("INSERT INTO agreements(id,owner,version,data) VALUES(?,?,?,?)")
      .bind(id, owner, 1, JSON.stringify(agreement))
      .run();
    return Response.json({ agreement }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Expiry must be in the future"
    )
      return Response.json({ error: error.message }, { status: 400 });
    return failure(error);
  }
}
