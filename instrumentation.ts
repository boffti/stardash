import * as Sentry from "@sentry/nextjs"
import type { LangfuseSpanProcessor as LangfuseSpanProcessorType } from "@langfuse/otel"

export let langfuseSpanProcessor: LangfuseSpanProcessorType | undefined

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")

    // Langfuse OTel span processor routes AI SDK telemetry to Langfuse. Optional:
    // self-hosters without keys get no exporter and no warnings.
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      const { LangfuseSpanProcessor } = await import("@langfuse/otel")
      const { NodeTracerProvider } = await import("@opentelemetry/sdk-trace-node")

      langfuseSpanProcessor = new LangfuseSpanProcessor({
        baseUrl: process.env.LANGFUSE_BASE_URL,
      })
      const tracerProvider = new NodeTracerProvider({
        spanProcessors: [langfuseSpanProcessor],
      })
      tracerProvider.register()
    }

    // Nightly jobs without a cron daemon (no-op in dev unless SCHEDULER=1).
    const { startScheduler } = await import("./lib/scheduler")
    startScheduler()
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
