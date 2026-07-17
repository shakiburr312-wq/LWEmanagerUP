// New file: Cloudinary Image Upload Helper
/**
 * Reusable helper function to upload an image file to Cloudinary.
 * @param file The File object to upload.
 * @returns A Promise resolving to the secure URL of the uploaded image.
 */
export async function uploadImage(file: File, folder?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'bssh2ivp');
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch('https://api.cloudinary.com/v1_1/to3zyeku/image/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error('Cloudinary upload response did not contain secure_url');
  }

  return data.secure_url;
}
