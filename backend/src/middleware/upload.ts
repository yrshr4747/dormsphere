import multer from 'multer';
import { Request } from 'express';

// Use memory storage — files stay in buffer, never touch disk.
// This is required for Render (ephemeral filesystem) + Cloudinary (upload from buffer).
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (video support)
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: any) => {
    const allowed = /^(image|video)\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed.'));
    }
  },
});

