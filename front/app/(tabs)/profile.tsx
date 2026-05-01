import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { profileApi } from '@api/profile';
import { useImagePicker } from '@hooks/useImagePicker';
import Toast from 'react-native-toast-message';

export default function ProfileScreen() {
  const { user, logout, refreshUser, updateUserLocally } = useAuth();
  const { showPickerOptions, isLoading: isPickerLoading } = useImagePicker();

  const [name, setName] = useState(user?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const { data } = await profileApi.updateProfile({ name: name.trim() });
      // Actualiza el usuario en contexto con la respuesta del servidor
      updateUserLocally({ name: data.data.name });
      Toast.show({ type: 'success', text1: '✅ Perfil actualizado' });
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: (err as { message?: string })?.message ?? 'Inténtalo de nuevo',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeAvatar = () => {
    showPickerOptions(async (image) => {
      if (!image) return;
      setIsUploadingAvatar(true);
      try {
        const { data: uploadData } = await profileApi.uploadAvatar(
          image.uri,
          image.fileName,
          image.mimeType,
        );
        const { data: profileData } = await profileApi.updateProfile({
          avatar_url: uploadData.data.url,
        });
        updateUserLocally({ avatar_url: profileData.data.avatar_url ?? uploadData.data.url });
        Toast.show({ type: 'success', text1: '📷 Foto actualizada' });
      } catch {
        Toast.show({ type: 'error', text1: 'Error al subir la imagen' });
      } finally {
        setIsUploadingAvatar(false);
      }
    });
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <TouchableOpacity
        style={styles.avatarWrapper}
        onPress={handleChangeAvatar}
        disabled={isUploadingAvatar || isPickerLoading}
      >
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        {(isUploadingAvatar || isPickerLoading) ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <View style={styles.avatarEditBadge}>
            <Text style={{ fontSize: 12 }}>✏️</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.emailText}>{user?.email}</Text>

      {/* Datos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos personales</Text>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Cerrar sesión */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.version}>AskUs v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 24, alignItems: 'center' },
  avatarWrapper: { marginBottom: 12, position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#4F46E5' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailText: { color: '#6B7280', fontSize: 14, marginBottom: 24 },
  section: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  label: { color: '#6B7280', fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  version: { color: '#D1D5DB', fontSize: 12 },
});
