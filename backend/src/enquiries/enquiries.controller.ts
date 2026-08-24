import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { EnquiriesService } from './enquiries.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { UpdateEnquiryStageDto } from './dto/update-enquiry-stage.dto';
import { ListEnquiriesQueryDto } from './dto/list-enquiries-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// There is deliberately no DELETE route: like Clients, enquiries are never
// hard-deleted; a closed enquiry is represented by its LOST/WON stage.
@Controller('enquiries')
@UseGuards(ActiveUserGuard)
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Post()
  create(@Body() dto: CreateEnquiryDto, @Session() session: AppSession) {
    return this.enquiriesService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListEnquiriesQueryDto, @Session() session: AppSession) {
    return this.enquiriesService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.enquiriesService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEnquiryDto, @Session() session: AppSession) {
    return this.enquiriesService.update(id, dto, session.user);
  }

  @Patch(':id/stage')
  updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateEnquiryStageDto,
    @Session() session: AppSession,
  ) {
    return this.enquiriesService.updateStage(id, dto, session.user);
  }
}
