import { businessConfigSchema, type BusinessConfig } from "./schema";
import exampleConfig from "./business.example.json";

let cached: BusinessConfig | null = null;

/**
 * MVP scope is a single business config (see project scope notes). Swapping this for a
 * per-tenant config lookup later is a matter of changing this one function.
 */
export function loadBusinessConfig(): BusinessConfig {
  if (!cached) {
    cached = businessConfigSchema.parse(exampleConfig);
  }
  return cached;
}
