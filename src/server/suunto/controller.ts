import { Context } from 'koa';

import { WebhookEvent } from './api';
import { suuntoService as service } from './service';

class SuuntoController {
  public async exchangeTokens(ctx: Context): Promise<void> {
    const authorizationCode = ctx.query.code as string;
    const c2cId = Number(ctx.query.state);

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.redirect(service.subscriptionSuccessUrl);
    } catch (error) {
      ctx.log.info(error);
      ctx.redirect(service.subscriptionErrorUrl);
    }
  }

  public async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    const auth = ctx.request.header.authorization;
    service.handleWebhookEvent(event, auth); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new SuuntoController();
