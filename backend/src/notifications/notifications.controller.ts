import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { NotificationsService } from './notifications.service';
import { NotificationsQueryDto } from './dto/notifications-query.dto';

// Authentication is enforced by Better Auth's global AuthGuard; ActiveUserGuard
// additionally rejects a deactivated user's session, exactly as on every
// other completed module. Notifications is READ-ONLY (Phase 9 decision D2:
// stateless — no read/unread state, no PATCH route) — organizationId always
// comes from `session.user`, never from a route/query parameter (the global
// forbidNonWhitelisted ValidationPipe rejects any attempt to supply one).
@Controller('notifications')
@UseGuards(ActiveUserGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Query() query: NotificationsQueryDto, @Session() session: AppSession) {
    return this.notificationsService.getNotifications(session.user, query);
  }
}
