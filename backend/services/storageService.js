const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const endpoint = process.env.STORAGE_ENDPOINT;
const region = process.env.STORAGE_REGION || "auto";
const bucket = process.env.STORAGE_BUCKET;

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY
  }
});

async function createUploadUrl({ key, contentType, size }) {
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: 10 * 60 }
  );
}

async function createDownloadUrl({ key, filename }) {
  const safe = String(filename).replace(/[\r\n"]/g, "_");
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safe}"`
    }),
    { expiresIn: 5 * 60 }
  );
}

async function objectExists(key, expectedSize) {
  const result = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );

  return Number(result.ContentLength) === Number(expectedSize);
}

async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

module.exports = {
  createUploadUrl,
  createDownloadUrl,
  objectExists,
  deleteObject
};
