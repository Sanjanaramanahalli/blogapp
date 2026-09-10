/**
 * Cloud and Local Storage Manager
 * Supports:
 * 1. Cloudinary Free Tier (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
 * 2. Supabase Storage (SUPABASE_URL, SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY)
 * 3. Local/Serverless Ephemeral Storage with Database BLOB Fallback (/uploads/)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Resolve a directory that is guaranteed writable without throwing EROFS
function getWritableUploadsDir() {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const localDir = path.join(__dirname, '..', '..', 'public', 'uploads');

  if (!isServerless) {
    try {
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.accessSync(localDir, fs.constants.W_OK);
      return localDir;
    } catch (_) {}
  }

  // Fallback to /tmp/uploads on serverless environments
  const tmpDir = path.join('/tmp', 'uploads');
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  } catch (err) {
    console.warn('Could not initialize /tmp/uploads:', err.message);
    return null;
  }
}

async function uploadToCloudStorage(file) {
  if (!file) return null;

  const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
  if (!fileBuffer) {
    throw new Error('No valid file data found to upload.');
  }

  // Ensure filename exists
  if (!file.filename) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const sanitizedBase = path.basename(file.originalname || 'upload', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 30);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    file.filename = `${sanitizedBase || 'cover'}-${uniqueSuffix}${ext}`;
  }

  // 1. Cloudinary Free Tier
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto.createHash('sha1')
        .update(`timestamp=${timestamp}${apiSecret}`)
        .digest('hex');

      const formData = new FormData();
      const fileBlob = new Blob([fileBuffer]);
      formData.append('file', fileBlob, file.filename);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.secure_url) {
        if (file.path && fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch (_) {}
        }
        return {
          url: data.secure_url,
          filename: data.public_id
        };
      }
      console.warn('Cloudinary upload returned non-200:', data);
    } catch (cloudErr) {
      console.error('Cloudinary upload error:', cloudErr);
    }
  }

  // 2. Supabase Storage
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'blog-uploads';

      const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${file.filename}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': file.mimetype || 'image/jpeg'
        },
        body: fileBuffer
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${file.filename}`;
        if (file.path && fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch (_) {}
        }
        return {
          url: publicUrl,
          filename: file.filename
        };
      }
      const errText = await res.text();
      console.warn('Supabase storage upload returned non-200:', errText);
    } catch (supabaseErr) {
      console.error('Supabase storage upload error:', supabaseErr);
    }
  }

  // 3. Fallback: Write to safe writable local/temp disk
  const targetDir = getWritableUploadsDir();
  if (targetDir) {
    try {
      const targetPath = path.join(targetDir, file.filename);
      fs.writeFileSync(targetPath, fileBuffer);
    } catch (fsErr) {
      console.warn('Disk write warning (proceeding with DB fallback):', fsErr.message);
    }
  }

  // 4. Fallback: Store into Database table for serverless instance resilience
  try {
    const { db } = require('../db/database');
    if (db) {
      db.prepare(`
        INSERT INTO uploaded_files (filename, mimetype, data)
        VALUES (?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET data = excluded.data, mimetype = excluded.mimetype
      `).run(file.filename, file.mimetype || 'image/jpeg', fileBuffer);
    }
  } catch (dbErr) {
    console.warn('Database upload persist note:', dbErr.message);
  }

  if (file.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path); } catch (_) {}
  }

  return {
    url: `/uploads/${file.filename}`,
    filename: file.filename
  };
}

module.exports = {
  uploadToCloudStorage
};
