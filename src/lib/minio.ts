// MinIO S3 API endpoints
const MINIO_ENDPOINT = import.meta.env.VITE_MINIO_ENDPOINT;
const ACCESS_KEY = import.meta.env.VITE_MINIO_ACCESS_KEY;
const SECRET_KEY = import.meta.env.VITE_MINIO_SECRET_KEY;
const BUCKET_NAME = import.meta.env.VITE_MINIO_BUCKET_NAME;

export const uploadToMinio = async (file: File, folder: string): Promise<string> => {
  try {
    const timestamp = Date.now();
    const fileName = `${folder}/${timestamp}-${file.name}`;
    
    // Create pre-signed PUT URL for upload
    const putUrl = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`;
    
    // Upload the file using fetch
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-amz-acl': 'public-read',
        Authorization: `Bearer ${ACCESS_KEY}:${SECRET_KEY}`
      },
      body: file
    });

    if (!response.ok) {
      throw new Error(`Error al subir archivo: ${response.statusText}`);
    }

    // Return the public URL for the uploaded file
    return `${MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error('Error al subir archivo a MinIO:', error);
    throw error;
  }
};