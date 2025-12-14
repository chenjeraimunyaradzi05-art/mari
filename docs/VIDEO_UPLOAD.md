# Video Upload API

## Endpoint
`POST /api/upload/video`

## Request
- **Method**: POST
- **Body**: `FormData`
- **Field**: `file` (The video file)

## Response
```json
{
  "videoPath": "/uploads/videos/uuid.mp4",
  "thumbnailPath": "/uploads/thumbnails/uuid.png",
  "duration": 120.5,
  "format": "mp4"
}
```

## Testing with Curl
```bash
curl -X POST -F "file=@/path/to/video.mp4" http://localhost:3000/api/upload/video
```

## Implementation Details
- Uses `fluent-ffmpeg` to transcode to 720p MP4 (H.264).
- Generates a thumbnail at 50% timestamp.
- Stores files in `public/uploads`.
- **Note**: Processing is currently synchronous. Large files may timeout on Vercel. Move to `bullmq` for production.
