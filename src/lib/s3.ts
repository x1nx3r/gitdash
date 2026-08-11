import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CreateBucketCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';

/**
 * Lazy S3 client backed by env vars. Returns null when the storage is not
 * configured so the rest of the app can fall back to dev/mock behavior.
 */
export function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  };
}

let client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  const cfg = getS3Config();
  if (!cfg) return null;
  if (!client) {
    client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return client;
}

export function isS3Configured(): boolean {
  return getS3Config() !== null;
}

/** Create the bucket on first use; safe to call repeatedly. */
export async function ensureBucket(): Promise<void> {
  const cfg = getS3Config();
  const s3 = getS3Client();
  if (!cfg || !s3) return;
  try {
    await s3.send(
      new CreateBucketCommand({ Bucket: cfg.bucket })
    );
  } catch (e) {
    // Bucket already exists, or the server auto-creates buckets.
    if (
      e instanceof S3ServiceException &&
      e.name !== 'BucketAlreadyExists' &&
      e.name !== 'BucketAlreadyOwnedByYou'
    ) {
      console.warn('ensureBucket:', e.name, e.message);
    }
  }
}

async function getObject(key: string): Promise<string | null> {
  const cfg = getS3Config();
  const s3 = getS3Client();
  if (!cfg || !s3) return null;
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key })
    );
    return res.Body ? await res.Body.transformToString() : null;
  } catch (e) {
    if (e instanceof S3ServiceException && e.name === 'NoSuchKey') return null;
    console.error(`s3 get ${key}:`, e);
    return null;
  }
}

async function putObject(key: string, body: string): Promise<void> {
  const cfg = getS3Config();
  const s3 = getS3Client();
  if (!cfg || !s3) return;
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    })
  );
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getObject(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function putJson(key: string, value: unknown): Promise<void> {
  await putObject(key, JSON.stringify(value));
}
