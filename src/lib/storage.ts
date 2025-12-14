import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 Client
// Note: In a real environment, ensure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, 
// and AWS_REGION are set in .env
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock',
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'moneyman-uploads';

export async function uploadFile(file: Buffer, contentType: string, folder: string = 'uploads'): Promise<string> {
  // If we are in a development environment without real credentials, return a mock URL
  if (process.env.NODE_ENV === 'development' && !process.env.AWS_ACCESS_KEY_ID) {
    console.log('Mocking upload for:', contentType);
    return `https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=1000`; // Return a placeholder video/image
  }

  const extension = contentType.split('/')[1] || 'bin';
  const key = `${folder}/${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: 'public-read', // Adjust based on bucket policy
  });

  try {
    await s3Client.send(command);
    // Return the public URL
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Upload failed');
  }
}
