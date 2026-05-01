// ─── Autenticación (formato FastAPI estándar) ─────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

/**
 * FastAPI con OAuth2PasswordBearer devuelve:
 *   { access_token: "...", token_type: "bearer" }
 * Si añades refresh token personalizado, puede incluir refresh_token.
 */
export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: 'bearer';
  expires_in?: number; // segundos
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token?: string;
  token_type: 'bearer';
}

// ─── Usuario ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  push_token?: string | null;
  is_active: boolean;
  created_at: string;   // ISO 8601
  updated_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar_url?: string;
  push_token?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  member_count: number;
  question_count: number;
  is_member: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface GroupMember {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  role: 'admin' | 'member';
  joined_at: string;
}

// ─── Preguntas ────────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  group_id: string;
  author: Pick<User, 'id' | 'name' | 'avatar_url'>;
  text: string;
  image_url?: string | null;
  answer_count: number;
  my_answer?: Answer | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface CreateQuestionRequest {
  group_id: string;
  text: string;
  image_url?: string;
}

export interface Answer {
  id: string;
  question_id: string;
  author: Pick<User, 'id' | 'name' | 'avatar_url'>;
  text: string;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAnswerRequest {
  question_id: string;
  text: string;
  image_url?: string;
}

// ─── Respuestas API ────────────────────────────────────────────────────────────
// FastAPI puede devolver directamente el objeto o envolverlo.
// Definimos ambos patrones para flexibilidad.

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];           // FastAPI convention suele usar "items"
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiError {
  detail?: string;                         // formato FastAPI por defecto
  message?: string;                        // por si tu API lo normaliza
  errors?: Record<string, string[]>;
  status?: number;
}

// ─── Notificaciones ───────────────────────────────────────────────────────────

export interface PushTokenRequest {
  push_token: string;
  platform: 'android' | 'ios';
}

// ─── Subida de archivos ───────────────────────────────────────────────────────

export interface UploadResponse {
  url: string;
  key: string;
}
