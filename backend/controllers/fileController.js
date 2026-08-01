const crypto = require("node:crypto");
const path = require("node:path");
const Commission = require("../models/Commission");
const FileRecord = require("../models/FileRecord");
const storage = require("../services/storageService");

const MAX_SIZE = Math.max(1, Number(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".txt", ".md", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".csv", ".json", ".xml",
  ".zip", ".7z", ".rar", ".js", ".ts", ".html", ".css", ".py"
]);
const ALLOWED_MIME_PREFIXES = ["image/", "text/"];
const ALLOWED_MIMES = new Set([
  "application/pdf", "application/zip", "application/x-7z-compressed",
  "application/vnd.rar", "application/json", "application/xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream"
]);

function cleanFilename(value) {
  return path.basename(String(value || "file"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim()
    .slice(0, 180) || "file";
}

function validType(name, mime) {
  const ext = path.extname(name).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) && (
    ALLOWED_MIMES.has(mime) || ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
  );
}

async function accessibleCommission(req, commissionId) {
  const commission = await Commission.findById(commissionId);
  if (!commission) return null;
  if (req.user.role === "admin") return commission;
  return commission.client.toString() === req.user._id.toString() ? commission : null;
}

async function requestUpload(req, res) {
  const { commissionId, originalName, mimeType, size } = req.body;
  let { category = "reference" } = req.body;
  const commission = await accessibleCommission(req, commissionId);

  if (!commission) return res.status(404).json({ success: false, message: "Commission not found." });
  if (req.user.role !== "admin") category = "reference";
  if (!["reference", "deliverable", "internal"].includes(category)) {
    return res.status(400).json({ success: false, message: "Invalid file category." });
  }

  const name = cleanFilename(originalName);
  const bytes = Number(size);
  const mime = String(mimeType || "application/octet-stream").toLowerCase();

  if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_SIZE) {
    return res.status(400).json({
      success: false,
      message: `File size must be between 1 byte and ${Math.round(MAX_SIZE / 1024 / 1024)} MB.`
    });
  }
  if (!validType(name, mime)) {
    return res.status(400).json({ success: false, message: "This file type is not allowed." });
  }

  const previous = await FileRecord.findOne({
    commission: commission._id,
    originalName: name,
    category
  }).sort({ version: -1 });
  const version = (previous?.version || 0) + 1;
  const key = `commissions/${commission._id}/${crypto.randomUUID()}${path.extname(name).toLowerCase()}`;

  const record = await FileRecord.create({
    commission: commission._id,
    uploadedBy: req.user._id,
    storageKey: key,
    originalName: name,
    mimeType: mime,
    size: bytes,
    category,
    version,
    status: "pending"
  });

  const uploadUrl = await storage.createUploadUrl({ key, contentType: mime, size: bytes });
  res.status(201).json({
    success: true,
    file: { id: record._id, originalName: name, version, category },
    uploadUrl,
    requiredHeaders: { "Content-Type": mime }
  });
}

async function completeUpload(req, res) {
  const record = await FileRecord.findById(req.params.id).select("+storageKey");
  if (!record) return res.status(404).json({ success: false, message: "File record not found." });
  const commission = await accessibleCommission(req, record.commission);
  if (!commission) return res.status(403).json({ success: false, message: "Access denied." });
  if (req.user.role !== "admin" && record.uploadedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const exists = await storage.objectExists(record.storageKey, record.size);
  if (!exists) return res.status(400).json({ success: false, message: "Uploaded file could not be verified." });
  record.status = "available";
  await record.save();
  res.json({ success: true, message: "File upload completed." });
}

async function listFiles(req, res) {
  const commission = await accessibleCommission(req, req.params.commissionId);
  if (!commission) return res.status(404).json({ success: false, message: "Commission not found." });

  const query = { commission: commission._id, status: "available" };
  if (req.user.role !== "admin") query.category = { $ne: "internal" };

  const files = await FileRecord.find(query)
    .populate("uploadedBy", "username role")
    .sort({ createdAt: -1 });
  res.json({ success: true, files });
}

async function getDownload(req, res) {
  const record = await FileRecord.findById(req.params.id).select("+storageKey");
  if (!record || record.status !== "available") {
    return res.status(404).json({ success: false, message: "File not found." });
  }
  const commission = await accessibleCommission(req, record.commission);
  if (!commission || (record.category === "internal" && req.user.role !== "admin")) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const downloadUrl = await storage.createDownloadUrl({
    key: record.storageKey,
    filename: record.originalName
  });
  res.json({ success: true, downloadUrl, expiresIn: 300 });
}

async function removeFile(req, res) {
  const record = await FileRecord.findById(req.params.id).select("+storageKey");
  if (!record) return res.status(404).json({ success: false, message: "File not found." });
  const commission = await accessibleCommission(req, record.commission);
  if (!commission) return res.status(403).json({ success: false, message: "Access denied." });

  const isUploader = record.uploadedBy.toString() === req.user._id.toString();
  if (req.user.role !== "admin" && !isUploader) {
    return res.status(403).json({ success: false, message: "Only the uploader or an administrator can delete this file." });
  }

  await storage.deleteObject(record.storageKey);
  await record.deleteOne();
  res.json({ success: true, message: "File deleted." });
}

module.exports = { requestUpload, completeUpload, listFiles, getDownload, removeFile };
