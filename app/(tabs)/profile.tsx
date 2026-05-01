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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { profileApi } from '@api/profile';
import { useImagePicker } from '@hooks/useImagePicker';
import Toast from 'react-native-toast-message';

// ─── Constante modo dev ───────────────────────────────────────────────────────

const USE_MOCK = true; // ← cambia a false cuando la API esté lista

// ─── Componente: campo de formulario ─────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  editable = true,
  autoCapitalize = 'words',
  keyboardType = 'default',
  errorText,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  editable?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  errorText?: string;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[
          fieldStyles.input,
          !editable && fieldStyles.inputDisabled,
          !!errorText && fieldStyles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secure}
        editable={editable}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
      {errorText ? <Text style={fieldStyles.error}>{errorText}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  inputDisabled: { backgroundColor: '#F9FAFB', color: '#9CA3AF' },
  inputError: { borderColor: '#EF4444' },
  error: { color: '#EF4444', fontSize: 12, marginTop: 4 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout, updateUserLocally } = useAuth();
  const { showPickerOptions, isLoading: isPickerLoading } = useImagePicker();

  // ── Estado formulario personal ────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // ── Estado cambiar contraseña ─────────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // ── Guardar perfil ────────────────────────────────────────────────────────

  const validateProfileForm = () => {
    if (!name.trim() || name.trim().length < 2) {
      setNameError('El nombre debe tener al menos 2 caracteres');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) return;
    setIsSavingProfile(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 800)); // simula latencia
        updateUserLocally({ name: name.trim() });
        Toast.show({ type: 'success', text1: '✅ Perfil actualizado' });
        return;
      }
      const { data } = await profileApi.updateProfile({ name: name.trim() });
      updateUserLocally({ name: data.name });
      Toast.show({ type: 'success', text1: '✅ Perfil actualizado' });
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: (err as { message?: string })?.message ?? 'Inténtalo de nuevo',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── Cambiar avatar ────────────────────────────────────────────────────────

  const handleChangeAvatar = () => {
    showPickerOptions(async (image) => {
      if (!image) return;
      setIsUploadingAvatar(true);
      try {
        if (USE_MOCK) {
          await new Promise((r) => setTimeout(r, 1000));
          updateUserLocally({ avatar_url: image.uri });
          Toast.show({ type: 'success', text1: '📷 Foto actualizada' });
          return;
        }
        const { data } = await profileApi.uploadAvatar(image.uri, image.fileName, image.mimeType);
        await profileApi.updateProfile({ avatar_url: data.url });
        updateUserLocally({ avatar_url: data.url });
        Toast.show({ type: 'success', text1: '📷 Foto actualizada' });
      } catch {
        Toast.show({ type: 'error', text1: 'Error al subir la imagen' });
      } finally {
        setIsUploadingAvatar(false);
      }
    });
  };

  // ── Cambiar contraseña ────────────────────────────────────────────────────

  const validatePasswordForm = () => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = 'Introduce tu contraseña actual';
    if (newPassword.length < 6) errs.newPassword = 'Mínimo 6 caracteres';
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
    setPasswordErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) return;
    setIsSavingPassword(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 800));
        Toast.show({ type: 'success', text1: '🔐 Contraseña actualizada' });
        closePasswordModal();
        return;
      }
      await profileApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      Toast.show({ type: 'success', text1: '🔐 Contraseña actualizada' });
      closePasswordModal();
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: (err as { message?: string })?.message ?? 'Contraseña actual incorrecta',
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordErrors({});
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
      ],
    );
  };

  // ── Avatar inicial ────────────────────────────────────────────────────────

  const initial = (user?.name ?? '?').charAt(0).toUpperCase();
  const hasAvatar = !!user?.avatar_url;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Avatar ───────────────────────────────────────────────────── */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handleChangeAvatar}
          disabled={isUploadingAvatar || isPickerLoading}
          activeOpacity={0.85}
        >
          {hasAvatar ? (
            <Image source={{ uri: user!.avatar_url! }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}

          {/* Overlay cargando */}
          {(isUploadingAvatar || isPickerLoading) && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}

          {/* Botón cámara */}
          {!isUploadingAvatar && !isPickerLoading && (
            <View style={styles.cameraBtn}>
              <Text style={{ fontSize: 14 }}>📷</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.avatarName}>{user?.name ?? '—'}</Text>
        <Text style={styles.avatarEmail}>{user?.email ?? '—'}</Text>

        {/* Badge activo */}
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>Cuenta activa</Text>
        </View>
      </View>

      {/* ── Datos personales ─────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos personales</Text>

        <Field
          label="Nombre completo"
          value={name}
          onChangeText={(v) => { setName(v); setNameError(''); }}
          placeholder="Tu nombre"
          errorText={nameError}
        />

        <Field
          label="Correo electrónico"
          value={user?.email ?? ''}
          editable={false}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.saveBtn, isSavingProfile && styles.btnDisabled]}
          onPress={handleSaveProfile}
          disabled={isSavingProfile}
        >
          {isSavingProfile ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Seguridad ────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seguridad</Text>
        <Text style={styles.cardSubtitle}>
          Cambia tu contraseña regularmente para mantener tu cuenta segura.
        </Text>
        <TouchableOpacity
          style={styles.passwordBtn}
          onPress={() => setShowPasswordModal(true)}
        >
          <Text style={styles.passwordBtnIcon}>🔐</Text>
          <Text style={styles.passwordBtnText}>Cambiar contraseña</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Cerrar sesión ────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutIcon}>🚪</Text>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.version}>AskUs v1.0.0</Text>

      {/* ── Modal cambiar contraseña ─────────────────────────────────── */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={closePasswordModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>

            <Field
              label="Contraseña actual"
              value={currentPassword}
              onChangeText={(v) => { setCurrentPassword(v); setPasswordErrors({}); }}
              placeholder="••••••••"
              secure
              errorText={passwordErrors.currentPassword}
            />
            <Field
              label="Nueva contraseña"
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setPasswordErrors({}); }}
              placeholder="Mínimo 6 caracteres"
              secure
              errorText={passwordErrors.newPassword}
            />
            <Field
              label="Confirmar nueva contraseña"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setPasswordErrors({}); }}
              placeholder="Repite la contraseña"
              secure
              errorText={passwordErrors.confirmPassword}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={closePasswordModal}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, isSavingPassword && styles.btnDisabled]}
                onPress={handleChangePassword}
                disabled={isSavingPassword}
              >
                {isSavingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { paddingBottom: 40 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: '#4F46E5' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#fff', borderRadius: 16, padding: 6,
    borderWidth: 2, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  avatarName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 2 },
  avatarEmail: { fontSize: 14, color: '#6B7280', marginBottom: 10 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  activeDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#10B981', marginRight: 5,
  },
  activeBadgeText: { fontSize: 12, fontWeight: '600', color: '#065F46' },

  // Tarjetas de sección
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    marginHorizontal: 20, marginBottom: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  cardSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 18 },

  // Botón guardar
  saveBtn: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.55 },

  // Botón cambiar contraseña
  passwordBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
  },
  passwordBtnIcon: { fontSize: 18, marginRight: 10 },
  passwordBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  chevron: { fontSize: 22, color: '#9CA3AF', lineHeight: 24 },

  // Cerrar sesión
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#FCA5A5',
    borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#FFF5F5',
  },
  logoutIcon: { fontSize: 16, marginRight: 8 },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },

  // Versión
  version: { textAlign: 'center', color: '#D1D5DB', fontSize: 12, marginTop: 4 },

  // Modal contraseña
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCancelText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  modalConfirm: {
    flex: 1, backgroundColor: '#4F46E5',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
