import { number, object, string } from 'joi';

import { Schema } from '../validator';

export const exchangeTokens: Schema = {
  query: object({
    code: string().required().min(5).max(50),
  }),
};

export const webhook: Schema = {
  body: object({
    username: string().required().min(1).max(50),
    workoutid: number().required().min(1).max(Number.MAX_VALUE),
  }),
  headers: object({
    Authorization: string().required(),
  }),
};
