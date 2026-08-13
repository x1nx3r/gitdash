import fs from 'node:fs';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const client = new S3Client({
  region: env.S3_REGION || 'us-east-1',
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const bucket = process.argv[2] ?? 'gitdash';

async function main() {
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
  const keys = (list.Contents ?? []).map(o => o.Key).sort();
  console.log('KEYS:', JSON.stringify(keys, null, 1));

  for (const key of keys) {
    if (!/^(configs\/|notifications\/|webhook_scope)/.test(key)) continue;
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = obj.Body ? await obj.Body.transformToString() : '';
    console.log(`\n=== ${key} ===\n${body}`);
  }
}

main().catch(e => {
  console.error('ERR:', e.name, e.message);
  process.exit(1);
});
