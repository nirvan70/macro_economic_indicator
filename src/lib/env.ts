import { promises as fs } from "fs";
import path from "path";

let loaded = false;

/** Load .env.local / .env into process.env (does not override existing). */
export async function loadEnvFiles(): Promise<void> {
  if (loaded) return;
  loaded = true;
  for (const name of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.join(process.cwd(), name), "utf8");
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // optional files
    }
  }
}

export function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}
