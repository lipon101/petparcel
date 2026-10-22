// CLI wrapper for the committed-secret guard. The scan logic lives in
// `shared/secret-scan.ts` (pure, unit-tested); this file only reports and sets
// the exit code.
//
// Run:  pnpm check:secrets   (or: node --import tsx scripts/check-secrets.ts)
// Exit: 0 when clean, 1 when anything is found (so CI can gate on it).
import { scanRepo, trackedFiles } from "../shared/secret-scan";

const findings = scanRepo();
const count = trackedFiles().length;

if (findings.length > 0) {
  console.error(`\n[secrets] FAILED: ${findings.length} potential secret(s) in ${count} tracked files:`);
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    "\nRemove the value from the file, rotate the credential, and supply it through the environment instead.",
  );
  process.exit(1);
}

console.log(`[secrets] OK: scanned ${count} tracked files, no committed secrets.`);
