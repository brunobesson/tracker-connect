export interface StravaInfo {
  id: number;
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
}

export interface SuuntoInfo {
  username: string;
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
}
export interface User {
  c2cId: number;
  strava?: StravaInfo;
  suunto?: SuuntoInfo;
}
