import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { SalesService } from './sales.service';
import { SalesPeriodQueryDto } from './dto/sales-period-query.dto';
import { RevenueBreakdownQueryDto } from './dto/revenue-breakdown-query.dto';
import { ListLostEnquiriesQueryDto } from './dto/list-lost-enquiries-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
// ActiveUserGuard additionally rejects a session belonging to a user who has
// since been deactivated, exactly as on Clients/Enquiries/Quotations/
// Follow-ups.
//
// Sales is a READ-ONLY aggregation layer over Enquiry / Quotation /
// QuotationLineItem / Product / Client / User. There are deliberately NO
// @Post/@Patch/@Delete routes here, and no Sales table exists to write to:
// every figure is derived from records the other modules own. All three
// UserRole values may read (see SalesService.assertCanRead).
//
// organizationId is never a route or query parameter — it always comes from
// `session.user`, and the global forbidNonWhitelisted ValidationPipe rejects
// any attempt to supply one.
@Controller('sales')
@UseGuards(ActiveUserGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('summary')
  getSummary(@Query() query: SalesPeriodQueryDto, @Session() session: AppSession) {
    return this.salesService.getSummary(session.user, query);
  }

  @Get('revenue-by-period')
  getRevenueByPeriod(@Query() query: SalesPeriodQueryDto, @Session() session: AppSession) {
    return this.salesService.getRevenueByPeriod(session.user, query);
  }

  @Get('revenue-by-client')
  getRevenueByClient(@Query() query: RevenueBreakdownQueryDto, @Session() session: AppSession) {
    return this.salesService.getRevenueByClient(session.user, query);
  }

  @Get('revenue-by-product')
  getRevenueByProduct(@Query() query: RevenueBreakdownQueryDto, @Session() session: AppSession) {
    return this.salesService.getRevenueByProduct(session.user, query);
  }

  @Get('revenue-by-representative')
  getRevenueByRepresentative(
    @Query() query: RevenueBreakdownQueryDto,
    @Session() session: AppSession,
  ) {
    return this.salesService.getRevenueByRepresentative(session.user, query);
  }

  @Get('lost-enquiries')
  getLostEnquiries(@Query() query: ListLostEnquiriesQueryDto, @Session() session: AppSession) {
    return this.salesService.getLostEnquiries(session.user, query);
  }
}
