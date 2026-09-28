declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AI?: {
      run(model: string, input: { state: unknown; questions: Record<string, unknown> }): Promise<unknown>;
    };
    ACCRUE_CLOUDFLARE_ACCOUNT_ID?: string;
    ACCRUE_CLOUDFLARE_AI_TOKEN?: string;
    ACCRUE_BEATAPI_API_KEY?: string;
    ACCRUE_JEV_VERIFIER_KEY?: string;
  }
}
