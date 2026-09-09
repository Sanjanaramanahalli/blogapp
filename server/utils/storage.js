/**
 * Cloud and Local Storage Manager
 * Supports:
 * 1. Cloudinary Free Tier (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
 * 2. Supabase Storage (SUPABASE_URL, SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY)
 * 3. Local Ephemeral Fallback (/uploads/)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function uploadToCloudStorage(file) {
  if (!file) return null;

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
      const fileBuffer = fs.readFileSync(file.path);
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
        try { fs.unlinkSync(file.path); } catch (_) {}
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
      const fileBuffer = fs.readFileSync(file.path);

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
        try { fs.unlinkSync(file.path); } catch (_) {}
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

  // 3. Fallback to Local Ephemeral Disk
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Render Note: Upload stored on local ephemeral filesystem. Set CLOUDINARY_* or SUPABASE_* environment variables for persistent cloud media storage.');
  }

  return {
    url: `/uploads/${file.filename}`,
    filename: file.filename
  };
}

module.exports = {
  uploadToCloudStorage
};
