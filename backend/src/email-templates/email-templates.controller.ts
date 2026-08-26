import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// There is deliberately no DELETE route and no status endpoint — a
// template either doesn't exist yet for a given key, or it exists and is
// edited in place; there is no lifecycle to deactivate. SALES_EXECUTIVE has
// no access to any route here (enforced in EmailTemplatesService, not
// here) — this is internal admin content.
@Controller('email-templates')
@UseGuards(ActiveUserGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Post()
  create(@Body() dto: CreateEmailTemplateDto, @Session() session: AppSession) {
    return this.emailTemplatesService.create(dto, session.user);
  }

  @Get()
  findAll(@Session() session: AppSession) {
    return this.emailTemplatesService.findAllForOrg(session.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.emailTemplatesService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Session() session: AppSession,
  ) {
    return this.emailTemplatesService.update(id, dto, session.user);
  }
}
