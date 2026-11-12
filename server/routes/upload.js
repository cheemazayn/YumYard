const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(dir, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' };
const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Unsupported file format. Please upload a JPG or PNG image (PDF is allowed for documents).'), { status: 400 })),
});

// Used for logos, banners, dish photos and business documents
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return next(err.code === 'LIMIT_FILE_SIZE' ? Object.assign(err, { status: 400, message: 'That file is larger than 3 MB.' }) : err);
    if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' });
    const base = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    res.status(201).json({ url: `${base}/uploads/${req.file.filename}`, name: req.file.originalname });
  });
});

module.exports = router;
