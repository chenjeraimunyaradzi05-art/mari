import { NextRequest, NextResponse } from 'next/server';
import { videoProcessor } from '@/lib/video/processor';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'File must be a video' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = os.tmpdir();
    // Sanitize filename or just use UUID
    const tempFilePath = path.join(tempDir, `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);

    await writeFile(tempFilePath, buffer);

    try {
      // Process the video
      // We pass the original filename to preserve extension/name logic if needed, 
      // but the processor uses it to name the output.
      // Let's give it a clean UUID based name for the output to avoid collisions.
      const outputName = `${uuidv4()}${path.extname(file.name)}`;
      const result = await videoProcessor.process(tempFilePath, outputName);
      
      // Clean up temp file
      await unlink(tempFilePath);

      return NextResponse.json(result);
    } catch (processError) {
      // Clean up temp file even if processing fails
      await unlink(tempFilePath).catch(() => {});
      console.error('Processing error:', processError);
      return NextResponse.json({ error: 'Video processing failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
