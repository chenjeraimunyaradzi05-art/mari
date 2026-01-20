/**
 * Camera Service
 * Step 86: Camera Integration for Stories/Verification
 */
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { api } from './api';

export interface MediaAsset {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  base64?: string;
}

export interface CaptureOptions {
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  exif?: boolean;
  base64?: boolean;
  videoMaxDuration?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission Required',
      'Please allow camera access to take photos and videos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Media Library Permission Required',
      'Please allow access to your photos and videos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

/**
 * Take a photo using the camera
 */
export async function takePhoto(options: CaptureOptions = {}): Promise<MediaAsset | null> {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: options.quality ?? 0.8,
      allowsEditing: options.allowsEditing ?? true,
      aspect: options.aspect ?? [1, 1],
      exif: options.exif ?? false,
      base64: options.base64 ?? false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;

    return {
      uri: asset.uri,
      type: 'image',
      fileName,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
    };
  } catch (error) {
    console.error('Error taking photo:', error);
    throw error;
  }
}

/**
 * Record a video using the camera
 */
export async function recordVideo(options: CaptureOptions = {}): Promise<MediaAsset | null> {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: options.quality ?? 0.7,
      allowsEditing: options.allowsEditing ?? true,
      videoMaxDuration: options.videoMaxDuration ?? 60,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() || `video_${Date.now()}.mp4`;

    return {
      uri: asset.uri,
      type: 'video',
      fileName,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    };
  } catch (error) {
    console.error('Error recording video:', error);
    throw error;
  }
}

/**
 * Pick image from media library
 */
export async function pickImageFromLibrary(options: CaptureOptions = {}): Promise<MediaAsset | null> {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: options.quality ?? 0.8,
      allowsEditing: options.allowsEditing ?? true,
      aspect: options.aspect ?? [1, 1],
      base64: options.base64 ?? false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;

    return {
      uri: asset.uri,
      type: 'image',
      fileName,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
    };
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
}

/**
 * Pick video from media library
 */
export async function pickVideoFromLibrary(options: CaptureOptions = {}): Promise<MediaAsset | null> {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: options.quality ?? 0.7,
      allowsEditing: options.allowsEditing ?? true,
      videoMaxDuration: options.videoMaxDuration ?? 300,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() || `video_${Date.now()}.mp4`;

    return {
      uri: asset.uri,
      type: 'video',
      fileName,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    };
  } catch (error) {
    console.error('Error picking video:', error);
    throw error;
  }
}

/**
 * Pick multiple images from media library
 */
export async function pickMultipleImages(maxCount: number = 10): Promise<MediaAsset[]> {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) return [];

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: maxCount,
    });

    if (result.canceled || !result.assets) {
      return [];
    }

    return result.assets.map((asset) => ({
      uri: asset.uri,
      type: 'image' as const,
      fileName: asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    }));
  } catch (error) {
    console.error('Error picking multiple images:', error);
    throw error;
  }
}

/**
 * Upload media to server
 */
export async function uploadMedia(
  asset: MediaAsset,
  uploadType: 'avatar' | 'story' | 'post' | 'verification' | 'message',
  onProgress?: (progress: UploadProgress) => void
): Promise<{ url: string; id: string }> {
  // First, get a presigned upload URL from the server
  const presignedResponse = await api.post('/upload/presigned', {
    fileName: asset.fileName,
    contentType: asset.type === 'image' ? 'image/jpeg' : 'video/mp4',
    uploadType,
  });

  const { uploadUrl, fileId, publicUrl } = presignedResponse.data.data;

  // Read file info
  const fileInfo = await FileSystem.getInfoAsync(asset.uri);
  if (!fileInfo.exists) {
    throw new Error('File does not exist');
  }

  // Upload to presigned URL
  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    asset.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': asset.type === 'image' ? 'image/jpeg' : 'video/mp4',
      },
    },
    (data) => {
      if (onProgress) {
        onProgress({
          loaded: data.totalBytesSent,
          total: data.totalBytesExpectedToSend,
          percentage: Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100),
        });
      }
    }
  );

  await uploadTask.uploadAsync();

  // Confirm upload with backend
  await api.post('/upload/confirm', {
    fileId,
    uploadType,
  });

  return { url: publicUrl, id: fileId };
}

/**
 * Take verification selfie with face detection hint
 */
export async function takeVerificationSelfie(): Promise<MediaAsset | null> {
  Alert.alert(
    'Verification Photo',
    'Please take a clear photo of your face. Make sure:\n\n• Good lighting\n• Face clearly visible\n• No sunglasses or hats\n• Neutral background',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: () => {} },
    ]
  );

  return takePhoto({
    quality: 0.9,
    allowsEditing: false,
    aspect: [1, 1],
  });
}

/**
 * Create a story (photo or video)
 */
export async function createStory(): Promise<MediaAsset | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Create Story',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const photo = await takePhoto({ allowsEditing: true, aspect: [9, 16] });
            resolve(photo);
          },
        },
        {
          text: 'Record Video',
          onPress: async () => {
            const video = await recordVideo({ videoMaxDuration: 30 });
            resolve(video);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const media = await pickImageFromLibrary({ aspect: [9, 16] });
            resolve(media);
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]
    );
  });
}
