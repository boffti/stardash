// Lets plain `node --experimental-strip-types` run app code: resolves "@/x" and
// extensionless "./x" imports the way Next/tsc do. Used by the check:* scripts.
import { register } from "node:module"
register(
  "data:text/javascript," +
    encodeURIComponent(`
  const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) spec = root + spec.slice(2);
    try { return await next(spec, ctx); }
    catch (e) {
      if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(e.code)) throw e;
      for (const ext of [".ts", ".tsx", "/index.ts"]) { try { return await next(spec + ext, ctx); } catch {} }
      throw e;
    }
  }
`),
  import.meta.url,
)
