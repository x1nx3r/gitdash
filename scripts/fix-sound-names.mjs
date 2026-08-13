import fs from 'node:fs';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
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

function decodeName(name) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

async function main() {
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
  const keys = (list.Contents ?? []).map(o => o.Key).sort();

  for (const key of keys) {
    if (!/^(sounds\/library\.json|configs\/)/.test(key)) continue;
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = obj.Body ? await obj.Body.transformToString() : '';
    let changed = false;

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }

    if (Array.isArray(data)) {
      for (const entry of data) {
        if (entry?.name && entry.name.includes('%')) {
          entry.name = decodeName(entry.name);
          changed = true;
        }
      }
    } else if (data && typeof data === 'object' && data.customSounds) {
      for (const custom of Object.values(data.customSounds)) {
        if (custom?.name && custom.name.includes('%')) {
          custom.name = decodeName(custom.name);
          changed = true;
        }
      }
    }

    if (changed) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: JSON.stringify(data),
          ContentType: 'application/json',
        })
      );
      console.log('fixed:', key);
    }
  }
}

main().catch(e => {
  console.error('ERR:', e.name, e.message);
  process.exit(1);
});