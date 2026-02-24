export interface JwtUserPayload {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  preferred_username?: string;
}

export interface SocketUserData {
  payload?: JwtUserPayload;
}

export interface IUserInfoExtractor {
  getFullName(user: SocketUserData | undefined | null): string;
  getFirstName(user: SocketUserData | undefined | null): string;
  getLastName(user: SocketUserData | undefined | null): string;
  getUserId(user: SocketUserData | undefined | null): string | undefined;
}
