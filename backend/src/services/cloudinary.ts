import { v2 as cloudinary } from 'cloudinary';

// Configure from CLOUDINARY_URL or individual env vars
// CLOUDINARY_URL format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
if (process.env.CLOUDINARY_URL) {
  // cloudinary auto-parses CLOUDINARY_URL
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
  });
}

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string = 'dormsphere',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto', // supports images and videos
        transformation: folder === 'dormsphere/profiles'
          ? [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
          : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result!.secure_url);
      },
    );
    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete a file from Cloudinary by its URL.
 */
export async function deleteFromCloudinary(url: string): Promise<void> {
  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/CLOUD/image/upload/vXXX/folder/filename.ext
    const parts = url.split('/upload/');
    if (parts.length < 2) return;
    const pathWithVersion = parts[1]; // vXXX/folder/filename.ext
    const publicId = pathWithVersion
      .replace(/^v\d+\//, '') // remove version
      .replace(/\.[^.]+$/, ''); // remove extension
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
}

export { cloudinary };
