import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: { ...process.env, SEMS_STANDALONE: "true" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
