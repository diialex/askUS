import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export interface PickedImage {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export function useImagePicker() {
  const [isLoading, setIsLoading] = useState(false);

  async function pickFromGallery(): Promise<PickedImage | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tu galería para subir imágenes.',
      );
      return null;
    }

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return null;

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        fileName: asset.fileName ?? `image_${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        fileSize: asset.fileSize,
      };
    } finally {
      setIsLoading(false);
    }
  }

  async function pickFromCamera(): Promise<PickedImage | null> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tu cámara para tomar fotos.',
      );
      return null;
    }

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return null;

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        fileName: `photo_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        fileSize: asset.fileSize,
      };
    } finally {
      setIsLoading(false);
    }
  }

  function showPickerOptions(
    onPick: (image: PickedImage | null) => void,
  ) {
    Alert.alert('Subir imagen', '¿Desde dónde?', [
      {
        text: 'Galería',
        onPress: async () => onPick(await pickFromGallery()),
      },
      {
        text: 'Cámara',
        onPress: async () => onPick(await pickFromCamera()),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return { isLoading, pickFromGallery, pickFromCamera, showPickerOptions };
}
