import apiClient from './client';
import type {
  Question,
  GroupQuestion,
  Answer,
  CreateQuestionRequest,
  SendQuestionToGroupRequest,
  CreateAnswerRequest,
  QuestionCategory,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

// ─── Pool de preguntas (admin) ────────────────────────────────────────────────

export const poolApi = {
  /** Lista las preguntas del pool global */
  list: (params?: { category?: QuestionCategory; active_only?: boolean; page?: number }) =>
    apiClient.get<PaginatedResponse<Question> & { success: boolean }>('/admin/questions', {
      params,
    }),

  /** Añade una pregunta al pool */
  create: (data: CreateQuestionRequest) =>
    apiClient.post<ApiResponse<Question>>('/admin/questions', data),

  /** Actualiza una pregunta del pool */
  update: (questionId: string, data: Partial<CreateQuestionRequest> & { is_active?: boolean }) =>
    apiClient.patch<ApiResponse<Question>>(`/admin/questions/${questionId}`, data),

  /** Elimina una pregunta del pool */
  delete: (questionId: string) =>
    apiClient.delete<ApiResponse<null>>(`/admin/questions/${questionId}`),
};

// ─── Preguntas de grupo ───────────────────────────────────────────────────────

export const groupQuestionsApi = {
  /**
   * Envía la siguiente pregunta a un grupo.
   * Si no se especifica question_uuid se elige una aleatoria del pool.
   */
  sendNext: (groupId: string, data: SendQuestionToGroupRequest = {}) =>
    apiClient.post<ApiResponse<GroupQuestion>>(
      `/groups/${groupId}/questions/next`,
      data,
    ),

  /** Historial de preguntas enviadas a un grupo */
  list: (groupId: string, page = 1) =>
    apiClient.get<PaginatedResponse<GroupQuestion> & { success: boolean }>(
      `/groups/${groupId}/questions`,
      { params: { page } },
    ),

  /** Pregunta activa actual de un grupo */
  getActive: (groupId: string) =>
    apiClient.get<ApiResponse<GroupQuestion>>(
      `/groups/${groupId}/questions/active`,
    ),

  /** Detalle de una group question */
  get: (groupQuestionId: string) =>
    apiClient.get<ApiResponse<GroupQuestion>>(`/group-questions/${groupQuestionId}`),

  /** Cierra la pregunta (solo el dueño del grupo) */
  close: (groupQuestionId: string) =>
    apiClient.post<ApiResponse<GroupQuestion>>(
      `/group-questions/${groupQuestionId}/close`,
    ),
};

// ─── Respuestas ───────────────────────────────────────────────────────────────

export const answersApi = {
  /** Respuestas de una group question */
  list: (groupQuestionId: string, page = 1) =>
    apiClient.get<PaginatedResponse<Answer> & { success: boolean }>(
      `/group-questions/${groupQuestionId}/answers`,
      { params: { page } },
    ),

  /** Enviar respuesta */
  create: (data: CreateAnswerRequest) =>
    apiClient.post<ApiResponse<Answer>>('/answers', data),

  /** Eliminar propia respuesta */
  delete: (answerId: string) =>
    apiClient.delete<ApiResponse<null>>(`/answers/${answerId}`),
};

// ─── Export unificado (retrocompatibilidad) ───────────────────────────────────

export const questionsApi = {
  ...poolApi,
  ...groupQuestionsApi,
  listAnswers: answersApi.list,
  createAnswer: answersApi.create,
  deleteAnswer: answersApi.delete,
};
