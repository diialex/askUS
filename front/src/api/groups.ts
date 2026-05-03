import apiClient from './client';
import type {
  Group,
  GroupMember,
  CreateGroupRequest,
  InviteInfo,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

export const groupsApi = {
  /** Listar grupos del usuario */
  getMyGroups: (page = 1) =>
    apiClient.get<PaginatedResponse<Group>>('/groups', { params: { page } }),

  /** Buscar grupos públicos */
  searchGroups: (query: string, page = 1) =>
    apiClient.get<PaginatedResponse<Group>>('/groups/search', {
      params: { q: query, page },
    }),

  /** Obtener detalle de un grupo */
  getGroup: (groupId: string) =>
    apiClient.get<ApiResponse<Group>>(`/groups/${groupId}`),

  /** Crear grupo */
  createGroup: (data: CreateGroupRequest) =>
    apiClient.post<ApiResponse<Group>>('/groups', data),

  /** Actualizar grupo */
  updateGroup: (groupId: string, data: Partial<CreateGroupRequest>) =>
    apiClient.put<ApiResponse<Group>>(`/groups/${groupId}`, data),

  /** Eliminar grupo */
  deleteGroup: (groupId: string) =>
    apiClient.delete<ApiResponse<null>>(`/groups/${groupId}`),

  /** Unirse a un grupo */
  joinGroup: (groupId: string) =>
    apiClient.post<ApiResponse<null>>(`/groups/${groupId}/join`),

  /** Salir de un grupo */
  leaveGroup: (groupId: string) =>
    apiClient.post<ApiResponse<null>>(`/groups/${groupId}/leave`),

  /** Listar miembros */
  getMembers: (groupId: string, page = 1) =>
    apiClient.get<PaginatedResponse<GroupMember>>(`/groups/${groupId}/members`, {
      params: { page },
    }),

  /** Obtener código/enlace de invitación */
  getInvite: (groupId: string) =>
    apiClient.get<ApiResponse<InviteInfo>>(`/groups/${groupId}/invite`),

  /** Unirse por código de invitación */
  joinByCode: (code: string) =>
    apiClient.post<ApiResponse<Group>>(`/groups/join-by-code/${code}`),

  /** Votar por la temática de la próxima pregunta (tras ver un anuncio) */
  voteCategory: (groupId: string, category: string) =>
    apiClient.post<ApiResponse<null>>(`/groups/${groupId}/vote-category`, null, {
      params: { category },
    }),
};
