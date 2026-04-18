import * as Sentry from "@sentry/nextjs";
import { Langfuse } from "langfuse";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
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
