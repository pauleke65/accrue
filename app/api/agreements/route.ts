import { authorize, database, failure, HttpError } from "@/lib/server";
import { createAgreement } from "@/lib/domain";
import { draftSchema } from "@/lib/validation";
export async function GET(request: Request) {
  try {
    const owner = await authorize(request);
    
    // We also need the user's email to fetch agreements where they are the earner/verifier.
    // Fetch it from our DB
    const user = await database()
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind(owner)
      .first<{ email: string }>();
      
    const email = user?.email || "";

    const result = await database()
      .prepare(
        "SELECT data FROM agreements WHERE payer_id = ? OR earner_email = ? OR verifier_email = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(owner, email, email)
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
      .prepare("SELECT data FROM agreements WHERE id = ?")
      .bind(id)
      .first<{ data: string }>();
    if (existing)
      return Response.json({ agreement: JSON.parse(existing.data) });
      
    const count = await database()
      .prepare("SELECT count(*) as n FROM agreements WHERE payer_id = ?")
      .bind(owner)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 100)
      throw new HttpError(429, "Sandbox limit: 100 agreements per workspace.");
      
    const parsedDraft = draftSchema.parse(data);
    const agreement = createAgreement(parsedDraft, id, owner);
    
    await database()
      .prepare("INSERT INTO agreements(id, payer_id, earner_email, verifier_email, version, data, status, created_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(id, owner, parsedDraft.earner, parsedDraft.verifier || null, 1, JSON.stringify(agreement), agreement.status, new Date().toISOString())
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
