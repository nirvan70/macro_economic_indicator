/**
 * Fetch official releases and refresh data/store.json.
 *
 *   npx tsx scripts/ingest.ts              # merge latest windows
 *   npx tsx scripts/ingest.ts --history    # replace with ~20y history where possible
 *   npx tsx scripts/ingest.ts --notify-only
 *   npx tsx scripts/ingest.ts --demo-update
 */

import { buildSnapshots } from "../src/lib/analysis";
import { sendUpdateEmail } from "../src/lib/email";
import { loadEnvFiles } from "../src/lib/env";
import { runIngest } from "../src/lib/ingest";
import { readStore, writeStore } from "../src/lib/store";

const args = new Set(process.argv.slice(2));

async function main() {
  await loadEnvFiles();
  if (args.has("--notify-only")) {
    const latestStore = await readStore();
    const pending = latestStore.pendingNotifications ?? [];
    if (pending.length === 0) {
      console.log("Nothing to notify.");
      return;
    }
    const snapshots = buildSnapshots(latestStore);
    const result = await sendUpdateEmail(snapshots, pending);
    console.log("Notify result:", result);
    if (result.sent || result.mode === "dry-run") {
      latestStore.pendingNotifications = [];
      latestStore.lastNotifiedAt = new Date().toISOString();
      await writeStore(latestStore);
    }
    return;
  }

  await runIngest({
    history: args.has("--history"),
    demoUpdate: args.has("--demo-update"),
    notify: args.has("--demo-update") || !args.has("--no-notify"),
    log: (message) => console.log(message),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
