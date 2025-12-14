import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caption = formData.get('caption') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get current user
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id;

    // Fallback for development if no session
    if (!userId && process.env.NODE_ENV === 'development') {
      const user = await prisma.user.findFirst();
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to S3 (or mock)
    const videoUrl = await uploadFile(buffer, file.type, 'videos');
    
    // Generate a thumbnail (mock for now, or use a service)
    // In a real app, we'd use ffmpeg here or rely on the video service (Mux) to generate it
    const thumbnailUrl = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=1000';

    // Create Post
    const post = await prisma.post.create({
      data: {
        authorId: userId,
        content: caption,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        tags: [], // Parse tags from caption if needed
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
