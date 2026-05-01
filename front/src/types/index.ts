// ─── Autenticación ────────────────────────────────────────────────────────────

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

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── Usuario ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  push_token?: string;
  created_at: string;
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
  description?: string;
  cover_url?: string;
  member_count: number;
  is_member: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  cover_url?: string;
}

export interface GroupMember {
  user_id: string;
  name: string;
  avatar_url?: string;
  role: 'admin' | 'member';
  joined_at: string;
}

// ─── Preguntas (pool global) ──────────────────────────────────────────────────

export type QuestionCategory =
  | 'amigos'
  | 'trabajo'
  | 'pareja'
  | 'familia'
  | 'general';

/** Una pregunta del pool global (sin grupo) */
export interface Question {
  id: string;
  category: QuestionCategory;
  text: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateQuestionRequest {
  text: string;
  category?: QuestionCategory;
  image_url?: string;
}

// ─── Preguntas de grupo ───────────────────────────────────────────────────────

/** Una pregunta del pool asignada a un grupo concreto */
export interface GroupQuestion {
  id: string;
  group_uuid: string;
  question: Question;
  status: 'active' | 'closed';
  answer_count: number;
  my_answer?: Answer;
  sent_at: string;
  closed_at?: string;
  created_at: string;
}

export interface SendQuestionToGroupRequest {
  /** Si se omite, se elige una aleatoria del pool */
  question_uuid?: string;
  /** Filtra la elección aleatoria por categoría */
  category?: QuestionCategory;
}

// ─── Respuestas ───────────────────────────────────────────────────────────────

export interface Answer {
  id: string;
  group_question_uuid: string;
  author: Pick<User, 'id' | 'name' | 'avatar_url'>;
  /** UUID del miembro del grupo elegido */
  selected_user_uuid: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateAnswerRequest {
  group_question_uuid: string;
  selected_user_uuid: string;
}

// ─── Respuestas API ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ApiError {
  /** Mensaje normalizado para mostrar al usuario */
  message: string;
  /** HTTP status code */
  status?: number;
  /** Campo detail tal como lo devuelve FastAPI (string o array de errores Pydantic) */
  detail?: string;
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
