import { authorize, database, failure } from "@/lib/server";
import { users } from "@/db/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

const schema = z.object({
  email: z.string().email(),
  walletAddress: z.string(),
});

export async function POST(request: Request) {
  try {
    const userId = await authorize(request);
    const body = await request.json();
    const { email, walletAddress } = schema.parse(body);

    const db = database();
    await db
      .insert(users)
      .values({
        id: userId,
        email,
        walletAddress,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { email, walletAddress },
      });

    const existingUser = await db.select().from(users).where(eq(users.id, userId)).get();

    return Response.json({ success: true, needsOnboarding: !existingUser?.name, user: existingUser });
  } catch (e) {
    return failure(e);
  }
}
