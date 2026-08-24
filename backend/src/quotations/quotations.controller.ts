import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';
import { ListQuotationsQueryDto } from './dto/list-quotations-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// There is deliberately no DELETE route: like Clients/Enquiries/Products, a
// quotation is never hard-deleted.
@Controller('quotations')
@UseGuards(ActiveUserGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  create(@Body() dto: CreateQuotationDto, @Session() session: AppSession) {
    return this.quotationsService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListQuotationsQueryDto, @Session() session: AppSession) {
    return this.quotationsService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.quotationsService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto, @Session() session: AppSession) {
    return this.quotationsService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationStatusDto,
    @Session() session: AppSession,
  ) {
    return this.quotationsService.updateStatus(id, dto, session.user);
  }
}
