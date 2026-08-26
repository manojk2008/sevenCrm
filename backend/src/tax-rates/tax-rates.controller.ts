import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { TaxRatesService } from './tax-rates.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { UpdateTaxRateStatusDto } from './dto/update-tax-rate-status.dto';
import { ListTaxRatesQueryDto } from './dto/list-tax-rates-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// There is deliberately no DELETE route: like ProductGroup, a tax rate is
// never hard-deleted; deactivation (status -> INACTIVE) is the lifecycle
// mechanism. Row-level SALES_EXECUTIVE read-only restriction is enforced
// entirely in TaxRatesService, not here.
@Controller('tax-rates')
@UseGuards(ActiveUserGuard)
export class TaxRatesController {
  constructor(private readonly taxRatesService: TaxRatesService) {}

  @Post()
  create(@Body() dto: CreateTaxRateDto, @Session() session: AppSession) {
    return this.taxRatesService.create(dto, session.user);
  }

  @Get()
  findAll(
    @Query() query: ListTaxRatesQueryDto,
    @Session() session: AppSession,
  ) {
    return this.taxRatesService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.taxRatesService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateDto,
    @Session() session: AppSession,
  ) {
    return this.taxRatesService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateStatusDto,
    @Session() session: AppSession,
  ) {
    return this.taxRatesService.updateStatus(id, dto, session.user);
  }
}
