import * as Sentry from "@sentry/nextjs";
import type { LangfuseSpanProcessor as LangfuseSpanProcessorType } from "@langfuse/otel";

export let langfuseSpanProcessor: LangfuseSpanProcessorType | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Langfuse OTel span processor — routes AI SDK telemetry to Langfuse
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");
    const { NodeTracerProvider } = await import("@opentelemetry/sdk-trace-node");

    langfuseSpanProcessor = new LangfuseSpanProcessor({
      baseUrl: process.env.LANGFUSE_BASE_URL,
    });
    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [langfuseSpanProcessor],
    });
    tracerProvider.register();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
