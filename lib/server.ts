import { verifyPrivyToken } from "./auth";
import { env } from "cloudflare:workers";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorize(request?: Request) {
  const authHeader = request?.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Sign in to access your private workspace.");
  }
  
  const token = authHeader.split(" ")[1];
  let userId: string;
  try {
    userId = await verifyPrivyToken(token);
  } catch (err) {
    throw new HttpError(401, "Invalid or expired session.");
  }
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new HttpError(403, "Cross-origin request rejected.");
    if (Number(request.headers.get("content-length") ?? 0) > 11000000)
      throw new HttpError(413, "Request too large.");
  }
  const window = Math.floor(Date.now() / 60000);
  const limit = await database()
    .prepare(
      "INSERT INTO request_limits(owner,window,count) VALUES(?,?,1) ON CONFLICT(owner) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END, window=excluded.window RETURNING count",
    )
    .bind(userId, window)
    .first<{ count: number }>();
  if ((limit?.count ?? 0) > 120)
    throw new HttpError(429, "Too many requests. Wait a minute and retry.");
  return userId;
}
export function database() {
  if (!env.DB) throw new HttpError(503, "Database is not configured.");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET)
    throw new HttpError(503, "Evidence storage is not configured.");
  return env.BUCKET;
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json(
      { error: "Please check the required fields, amounts, and dates." },
      { status: 400 },
    );
  console.error(
    "Accrue request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return Response.json(
    { error: "Unable to complete the request. Please retry." },
    { status: 500 },
  );
}
