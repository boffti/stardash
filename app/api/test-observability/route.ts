import * as Sentry from "@sentry/nextjs";
import { Langfuse } from "langfuse";
import { NextRequest, NextResponse } from "next/server";

// This endpoint fires live Sentry events and Langfuse traces.
// Guard it with CRON_SECRET so it is never callable from the public browser —
// use `curl -H "Authorization: Bearer <CRON_SECRET>" <url>` for local testing.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 1. Send a test event to Sentry
  Sentry.captureMessage("StarDash observability test — Sentry connected", "info");

  // 2. Send a test trace to Langfuse — explicit credentials to bypass env var issues
  const langfuseResult = { status: "unknown", error: null as string | null };
  try {
    const langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    });
    const trace = langfuse.trace({
      name: "observability-test",
      input: { source: "test-observability route" },
    });
    const span = trace.span({ name: "test-span" });
    span.end({ output: { success: true } });
    await langfuse.flushAsync();
    langfuseResult.status = "sent";
  } catch (err: unknown) {
    langfuseResult.status = "error";
    langfuseResult.error = err instanceof Error ? err.message : String(err);
  }

  // Env var check (values redacted, just presence)
  const envCheck = {
    LANGFUSE_SECRET_KEY: !!process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY: !!process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL ?? "not set",
  };

  return NextResponse.json({
    sentry: "event captured",
    langfuse: langfuseResult,
    envCheck,
    timestamp: new Date().toISOString(),
  });
}
