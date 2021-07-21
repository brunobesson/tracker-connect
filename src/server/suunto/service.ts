import dayjs from 'dayjs';
import pino from 'pino';

import { Vendor } from '../../repository/activity';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { SuuntoAuth, Workouts, suuntoApi as api, workoutTypes, WebhookEvent, WorkoutSummary, suuntoApi } from './api';

const log = pino();

export class SuuntoService {
  readonly subscriptionErrorUrl: string;
  readonly subscriptionSuccessUrl: string;
  readonly #clientSecret: string;
  readonly #suuntoSubscriptionKey: string;
  readonly #suuntoWebhookSubscriptionToken: string;

  constructor() {
    [
      'FRONTEND_BASE_URL',
      'SUBSCRIPTION_ERROR_URL',
      'SUBSCRIPTION_SUCCESS_URL',
      'SUUNTO_CLIENT_SECRET',
      'SUUNTO_SUBSCRIPTION_KEY',
      'SUUNTO_WEBHOOK_SUBSCRIPTION_TOKEN',
    ].forEach((envvar) => {
      if (!process.env[envvar]) {
        throw new Error(`Missing configuration variable: ${envvar}`);
      }
    });
    this.subscriptionErrorUrl = `${process.env.FRONTEND_BASE_URL}/${process.env.SUBSCRIPTION_ERROR_URL}`;
    this.subscriptionSuccessUrl = `${process.env.FRONTEND_BASE_URL}/${process.env.SUBSCRIPTION_SUCCESS_URL}`;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.#suuntoSubscriptionKey = process.env.SUUNTO_SUBSCRIPTION_KEY!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.#suuntoWebhookSubscriptionToken = process.env.SUUNTO_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN!;
    this.#clientSecret = process.env.SUUNTO_CLIENT_SECRET!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const token = await api.exchangeTokens(authorizationCode, this.subscriptionSuccessUrl);
    this.setupUser(c2cId, token); // do this asynchronously
  }

  async setupUser(c2cId: number, auth: SuuntoAuth): Promise<void> {
    try {
      // TODO check user exists, check rights?
      // retrieve last 30 outings
      const workouts: Workouts = await api.getWorkouts(auth.access_token, this.#suuntoSubscriptionKey);
      await userService.configureSuunto(c2cId, auth);
      await userService.addActivities(
        c2cId,
        ...workouts.payload.map((workout) => ({
          vendor: 'suunto' as Vendor,
          vendorId: workout.workoutkey,
          date: dayjs(workout.startTime).format(),
          name: workout.workoutName,
          type: workoutTypes[workout.activityId],
        })),
      );
    } catch (err) {
      log.error(err);
    }
  }

  async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const suuntoInfo = await userService.getSuuntoInfo(c2cId);
    if (suuntoInfo?.access_token && dayjs(suuntoInfo.expires_at).isAfter(dayjs().subtract(1, 'minute'))) {
      return suuntoInfo.access_token;
    }
    if (suuntoInfo?.refresh_token) {
      const auth = await api.refreshAuth(suuntoInfo.refresh_token);
      await userService.updateSuuntoAuth(c2cId, auth);
      return suuntoInfo.access_token;
    }
  }

  async handleWebhookEvent(event: WebhookEvent, authHeader: string | undefined): Promise<void> {
    if (await !this.isWebhookHeaderValid(authHeader)) {
      return;
    }
    // TODO: retrieve workout summary, store in db (may be an update?)
    const user = await userRepository.findBySuuntoUsername(event.username);
    if (!user) {
      log.warn(
        `Suuntp workout webhook event for Suunto user ${event.username} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let workout: WorkoutSummary;
    try {
      workout = await suuntoApi.getWorkoutDetails(token, event.workoutid, this.#suuntoSubscriptionKey);
    } catch (error) {
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, {
        vendor: 'suunto' as Vendor,
        vendorId: workout.payload.workoutkey,
        date: dayjs(workout.payload.startTime).format(),
        name: workout.payload.workoutName,
        type: workoutTypes[workout.payload.activityId],
      });
    } catch (error) {
      log.warn(
        `Strava activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to insert activity data`,
      );
    }
  }

  async isWebhookHeaderValid(authHeader: string | undefined): Promise<boolean> {
    return authHeader === `Bearer: ${this.#suuntoWebhookSubscriptionToken}`;
  }
}

export const suuntoService = new SuuntoService();
