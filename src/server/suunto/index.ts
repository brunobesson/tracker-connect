import Router from 'koa-router';

import { validate } from '../validator';

import { controller } from './controller';
import { exchangeTokens, webhook } from './validators';

const router = new Router();

router.get('/exchange_token', validate(exchangeTokens), controller.exchangeTokens.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
