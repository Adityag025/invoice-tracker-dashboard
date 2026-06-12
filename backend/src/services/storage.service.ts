import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface StoredFile {
  url: string;
  storageType: 'local' | 'cloudinary';
  fileName: string;
}

export async function storeFile(file: Express.Multer.File): Promise<StoredFile> {
  // If Cloudinary is configured, upload there
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    return uploadToCloudinary(file);
  }
  // Otherwise serve from local disk
  const relativePath = `/uploads/${file.filename}`;
  return { url: relativePath, storageType: 'local', fileName: file.filename };
}

async function uploadToCloudinary(file: Express.Multer.File): Promise<StoredFile> {
  const { v2: cloudinary } = await import('cloudinary');
  const result = await cloudinary.uploader.upload(file.path, {
    resource_type: 'auto',
    folder: 'invoice-tracker',
    public_id: path.parse(file.filename).name,
  });
  // Remove local temp file after Cloudinary upload
  fs.unlink(file.path, () => {});
  return { url: result.secure_url, storageType: 'cloudinary', fileName: file.filename };
}

export function deleteLocalFile(fileName: string): void {
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
}
