import { authorize, database, failure } from "@/lib/server";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1, "Name is required") });

export async function POST(request: Request) {
  try {
    const userId = await authorize(request);
    const { name } = schema.parse(await request.json());

    const db = database();
    await db
      .update(users)
      .set({ name })
      .where(eq(users.id, userId));

    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
