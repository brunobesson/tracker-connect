import axios, { AxiosResponse } from 'axios';

import { AppError } from '../../errors';

/*
{
  "access_token": "xxx.yyy",
  "token_type": "bearer",
  "refresh_token": "aaa.bbb",
  "expires_in": 86399,
  "scope": "workout",
  "ukv": "1",
  "uk": "zzz",
  "user": "brunobesson",
  "jti": "aaaa-bbb-ccc-ddd-eee"
}

*/
export interface SuuntoAuth {
  access_token: string;
  token_type: 'bearer';
  refresh_token: string;
  expires_in: number;
  user: string;
}

export type SuuntoRefreshAuth = Omit<SuuntoAuth, 'user'>;

export const workoutTypes = [
  'GENERIC', // 0
  'RUNNING', // 1
  'CYCLING', // 2
  undefined,
  'FITNESS_EQUIPMENT', // 4
  'SWIMMING', // 5
  'BASKETBALL', // 6
  'SOCCER', // 7
  undefined,
  'AMERICAN_FOOTBALL', // 9
  'TRAINING', // 10
  'WALKING', // 11
  'CROSS_COUNTRY_SKIING', // 12
  'ALPINE_SKIING', // 13
  undefined,
  undefined,
  'MOUNTAINEERING', // 16
  'HIKING', // 17
  'MULTISPORT', // 18
  'PADDLING', // 19
  undefined,
  undefined,
  undefined,
  undefined,
  'DRIVING', // 24
  'GOLF', // 25
  'HANG_GLIDING', // 26 - paragliding
  'HORSEBACK_RIDING', // 27
  'HUNTING', // 28
  'FISHING', // 29
  undefined,
  undefined,
  'SAILING', // 32
  'ICE_SKATING', // 33
  undefined,
  'SNOWSHOEING', // 35
  undefined,
  'STAND_UP_PADDLEBOARDING', // 37
  'SURFING', // 38
  undefined,
  undefined,
  undefined,
  undefined,
  'WINDSURFING', // 43
  'JITESURFING', // 44
  undefined,
  undefined,
  'BOXING', // 47
  'FLOOR_CLIMBING', // 48
];

export interface Position {
  x: number;
  y: number;
}

export interface Workout {
  workoutId: number;
  workoutkey: string; // Workout unique id
  workoutName: string;
  activityId: number; // Activity/workout type id. Activity mapping can be found in the FIT file activity id's document (check Suunto App column).
  description: string;
  startTime: number; // e.g. 1625986322376 unix epoch with milliseconds
  totalTime: number; // e.g. 6452.1
  timeOffsetInMinutes: number; // Timezone offset in minutes. 0 for UTC.
}

export interface Error {
  code: string;
  description: string;
}
export interface Workouts {
  error?: Error | null;
  metadata: { [key: string]: string };
  payload: Workout[];
}

export interface WorkoutSummary {
  error?: Error | null;
  metadata: { [key: string]: string };
  payload: Workout;
}

export interface WebhookEvent {
  username: string;
  workoutid: number;
}

export class SuuntoApi {
  private readonly oauthBaseUrl = 'https://cloudapi-oauth.suunto.com/';
  private readonly baseUrl = 'https://cloudapi.suunto.com/v2/';
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    ['SUUNTO_CLIENT_ID', 'SUUNTO_CLIENT_SECRET'].forEach((envvar) => {
      if (!process.env[envvar]) {
        throw new Error(`Missing configuration variable: ${envvar}`);
      }
    });
    this.#clientId = process.env.SUUNTO_CLIENT_ID!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this.#clientSecret = process.env.SUUNTO_CLIENT_SECRET!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async exchangeTokens(code: string, redirect: string): Promise<SuuntoAuth> {
    try {
      const response: AxiosResponse<SuuntoAuth> = await axios.post<SuuntoAuth>(
        `${this.oauthBaseUrl}oauth/token`,
        null,
        {
          params: {
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirect,
          },
          auth: {
            username: this.#clientId,
            password: this.#clientSecret,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Suunto token exchange request', error);
      }
      throw new AppError(500, 'Error on Suunto token exchange request', error);
    }
  }

  async refreshAuth(token: string): Promise<SuuntoRefreshAuth> {
    try {
      const response: AxiosResponse<SuuntoRefreshAuth> = await axios.post<SuuntoRefreshAuth>(
        `${this.oauthBaseUrl}oauth/token`,
        null,
        {
          params: {
            refresh_token: token,
            grant_type: 'refresh_token',
          },
          auth: {
            username: this.#clientId,
            password: this.#clientSecret,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Suunto refresh token request', error);
      }
      throw new AppError(500, 'Error on Suunto refresh token request', error);
    }
  }

  async getWorkouts(token: string, subscriptionKey: string): Promise<Workouts> {
    try {
      const response = await axios.get<Workouts>(`${this.baseUrl}workouts?limit=30`, {
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava getWorkouts request', error);
      }
      throw new AppError(500, 'Error on Strava getWorkouts request', error);
    }
  }

  async getWorkoutDetails(token: string, id: number, subscriptionKey: string): Promise<WorkoutSummary> {
    try {
      const response = await axios.get<WorkoutSummary>(`${this.baseUrl}workouts/${id}`, {
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava getWorkoutDetails request', error);
      }
      throw new AppError(500, 'Error on Strava getWorkoutDetails request', error);
    }
  }

  // Id is workout id or key
  async getFIT(token: string, id: string): Promise<Buffer> {
    try {
      const response = await axios.get<Buffer>(`${this.baseUrl}workout/exportFit${id}`, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava getActivity request', error);
      }
      throw new AppError(500, 'Error on Strava getActivity request', error);
    }
  }
}

export const suuntoApi = new SuuntoApi();
