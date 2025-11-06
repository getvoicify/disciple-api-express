/**
 * User information type for embedding in API responses
 */
export interface UserInfo {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
}
