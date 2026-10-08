#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const statePath = resolve(root, 'public/data/portal-state.json');
const bucketName = process.env.VITE_S3_BUCKET_NAME || 'devops-guide-portal-848175179383';

if (!existsSync(statePath)) {
  console.error(`Error: State file not found at ${statePath}`);
  process.exit(1);
}

try {
  console.log(`[sync-cloud] Syncing ${statePath} to s3://${bucketName}/data/portal-state.json...`);
  execSync(
    `aws s3 cp "${statePath}" "s3://${bucketName}/data/portal-state.json" --content-type application/json`,
    { stdio: 'inherit' },
  );

  const distStateDir = resolve(root, 'dist/data');
  if (existsSync(resolve(root, 'dist'))) {
    execSync(`mkdir -p "${distStateDir}" && cp "${statePath}" "${distStateDir}/portal-state.json"`);
  }

  console.log('[sync-cloud] Successfully published central portal state to AWS S3 cloud store!');
} catch (err) {
  console.error('[sync-cloud] Failed to sync to AWS S3:', err.message);
  process.exit(1);
}
