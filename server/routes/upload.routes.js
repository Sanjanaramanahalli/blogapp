const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'avatar', maxCount: 1 }
]);

function handleUpload(req, res) {
  uploadFields(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image exceeds maximum allowed size of 5MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    const uploadedFile = req.file || (req.files && (
      (req.files.image && req.files.image[0]) ||
      (req.files.cover && req.files.cover[0]) ||
      (req.files.file && req.files.file[0]) ||
      (req.files.avatar && req.files.avatar[0])
    ));

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const fileUrl = `/uploads/${uploadedFile.filename}`;
    const successMsg = uploadedFile.fieldname === 'avatar' 
      ? 'Profile photo uploaded successfully.' 
      : 'Image uploaded successfully.';

    res.status(200).json({
      message: successMsg,
      url: fileUrl,
      filename: uploadedFile.filename
    });
  });
}

// Support both /api/uploads (authenticated) and /api/uploads/cover (admin)
router.post('/', requireAuth, handleUpload);
router.post('/cover', requireAdmin, handleUpload);

module.exports = router;
