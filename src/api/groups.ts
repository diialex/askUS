import apiClient from './client';
import type {
  Group,
  GroupMember,
  CreateGroupRequest,
  PaginatedResponse,
} from '@/types';

export const groupsApi = {
  /** GET /groups/me — grupos en los que estoy */
  getMyGroups: (page = 1, size = 20) =>
    apiClient.get<PaginatedResponse<Group>>('/groups/me', { params: { page, size } }),

  /** GET /groups — explorar grupos disponibles */
  getAllGroups: (page = 1, size = 20) =>
    apiClient.get<PaginatedResponse<Group>>('/groups', { params: { page, size } }),

  /** GET /groups?search=... */
  searchGroups: (query: string, page = 1, size = 20) =>
    apiClient.get<PaginatedResponse<Group>>('/groups', {
      params: { search: query, page, size },
    }),

  /** GET /groups/:id */
  getGroup: (groupId: string) =>
    apiClient.get<Group>(`/groups/${groupId}`),

  /** POST /groups */
  createGroup: (data: CreateGroupRequest) =>
    apiClient.post<Group>('/groups', data),

  /** PATCH /groups/:id */
  updateGroup: (groupId: string, data: Partial<CreateGroupRequest>) =>
    apiClient.patch<Group>(`/groups/${groupId}`, data),

  /** DELETE /groups/:id */
  deleteGroup: (groupId: string) =>
    apiClient.delete<void>(`/groups/${groupId}`),

  /** POST /groups/:id/join */
  joinGroup: (groupId: string) =>
    apiClient.post<{ message: string }>(`/groups/${groupId}/join`),

  /** POST /groups/:id/leave */
  leaveGroup: (groupId: string) =>
    apiClient.post<{ message: string }>(`/groups/${groupId}/leave`),

  /** GET /groups/:id/members */
  getMembers: (groupId: string, page = 1) =>
    apiClient.get<PaginatedResponse<GroupMember>>(`/groups/${groupId}/members`, {
      params: { page },
    }),
};
