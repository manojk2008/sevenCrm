import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed. This
// is a "current organization" settings API only — no org-management CRUD
// (no POST/DELETE, no :id routes): the target organization always comes
// from the session, never from client input.
@Controller('organizations')
@UseGuards(ActiveUserGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  findMine(@Session() session: AppSession) {
    return this.organizationsService.findMine(session.user);
  }

  @Patch('me')
  updateMine(@Body() dto: UpdateOrganizationDto, @Session() session: AppSession) {
    return this.organizationsService.updateMine(dto, session.user);
  }
}
