import apiClient from './client';
import type {
  Question,
  Answer,
  CreateQuestionRequest,
  CreateAnswerRequest,
  UploadResponse,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

export const questionsApi = {
  /** Preguntas de un grupo */
  getGroupQuestions: (groupId: string, page = 1) =>
    apiClient.get<PaginatedResponse<Question>>(`/groups/${groupId}/questions`, {
      params: { page },
    }),

  /** Detalle de una pregunta */
  getQuestion: (questionId: string) =>
    apiClient.get<ApiResponse<Question>>(`/questions/${questionId}`),

  /** Crear pregunta */
  createQuestion: (data: CreateQuestionRequest) =>
    apiClient.post<ApiResponse<Question>>('/questions', data),

  /** Eliminar pregunta */
  deleteQuestion: (questionId: string) =>
    apiClient.delete<ApiResponse<null>>(`/questions/${questionId}`),

  /** Respuestas de una pregunta */
  getAnswers: (questionId: string, page = 1) =>
    apiClient.get<PaginatedResponse<Answer>>(`/questions/${questionId}/answers`, {
      params: { page },
    }),

  /** Responder una pregunta */
  createAnswer: (data: CreateAnswerRequest) =>
    apiClient.post<ApiResponse<Answer>>('/answers', data),

  /** Actualizar respuesta */
  updateAnswer: (answerId: string, text: string) =>
    apiClient.put<ApiResponse<Answer>>(`/answers/${answerId}`, { text }),

  /** Eliminar respuesta */
  deleteAnswer: (answerId: string) =>
    apiClient.delete<ApiResponse<null>>(`/answers/${answerId}`),

  /** Subir imagen adjunta a pregunta/respuesta */
  uploadImage: (uri: string, fileName: string, mimeType: string) => {
    const form = new FormData();
    form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
    return apiClient.post<ApiResponse<UploadResponse>>('/uploads/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
