import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface ImagePickerResult {
  uri: string;
  type: string;
  name: string;
}

/**
 * Custom hook for cross-platform image selection
 * - Uses expo-image-picker on iOS/Android
 * - Uses HTML file input on web
 */
export const useImagePicker = () => {
  const pickImage = async (options?: {
    mediaType?: 'photo' | 'video' | 'mixed';
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }): Promise<ImagePickerResult | null> => {
    if (Platform.OS === 'web') {
      return pickImageWeb(options);
    }

    return pickImageNative(options);
  };

  return { pickImage };
};

async function pickImageWeb(options?: {
  mediaType?: 'photo' | 'video' | 'mixed';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            uri: reader.result as string,
            type: file.type,
            name: file.name,
          });
        };
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };

    input.click();
  });
}

async function pickImageNative(options?: {
  mediaType?: 'photo' | 'video' | 'mixed';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult | null> {
  try {
    // Request camera roll permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Camera roll permissions denied');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: options?.mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options?.allowsEditing ?? false,
      aspect: options?.aspect,
      quality: options?.quality ?? 1,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || 'image.jpg',
    };
  } catch (error) {
    console.error('ImagePicker Error:', error);
    return null;
  }
}
