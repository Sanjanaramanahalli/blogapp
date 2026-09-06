const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');

router.post('/cover', requireAdmin, (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image exceeds maximum allowed size of 5MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({
      message: 'Cover image uploaded successfully.',
      url: fileUrl,
      filename: req.file.filename
    });
  });
});

module.exports = router;
