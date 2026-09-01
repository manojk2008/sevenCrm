import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { EnquirySourcesService } from './enquiry-sources.service';
import { CreateEnquirySourceDto } from './dto/create-enquiry-source.dto';
import { ListEnquirySourcesQueryDto } from './dto/list-enquiry-sources-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// Deliberately just these two routes — create and list. Unlike
// ProductGroup/TaxRate there is no status/deactivate lifecycle and no
// update/delete: a source is a small, additive, user-created list, not a
// managed catalog.
@Controller('enquiry-sources')
@UseGuards(ActiveUserGuard)
export class EnquirySourcesController {
  constructor(private readonly enquirySourcesService: EnquirySourcesService) {}

  @Post()
  create(@Body() dto: CreateEnquirySourceDto, @Session() session: AppSession) {
    return this.enquirySourcesService.create(dto, session.user);
  }

  @Get()
  findAll(
    @Query() query: ListEnquirySourcesQueryDto,
    @Session() session: AppSession,
  ) {
    return this.enquirySourcesService.findAllForOrg(session.user, query);
  }
}
