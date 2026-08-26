import { ForbiddenException, Injectable } from '@nestjs/common';
import { prisma } from '../auth/auth';
import { UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';

type CurrentUser = AppSession['user'];

export interface SafeAnalyticsUnavailableMetric {
  key: string;
  label: string;
  reason: string;
}

export interface SafeAnalyticsSummary {
  period: { from: Date | null; to: Date | null; basis: 'ENQUIRY_CREATED_AT' };
  /** Count of Enquiry rows raised in this period. */
  newEnquiries: number;
  /**
   * Metrics the old mock Analytics UI displayed that this database cannot
   * support. Declared by the API, not hardcoded in the frontend, so the UI
   * renders an honest "unavailable" state instead of a fabricated number.
   * Revenue, win rate, and average deal size are NOT duplicated here — the
   * frontend reads those directly from GET /sales/summary (Phase 8 decision
   * D6: Analytics never recomputes a figure Sales already owns).
   */
  unavailableMetrics: SafeAnalyticsUnavailableMetric[];
}

@Injectable()
export class AnalyticsService {
  // Analytics is a read-only aggregation layer, same as Dashboard and Sales.
  // It owns no table and writes nothing. Its only genuinely new figure
  // (newEnquiries) is one Sales has no reason to compute; every revenue/
  // win-rate/average-deal-size figure is read by the frontend directly from
  // the existing /sales/* endpoints rather than being recomputed here.
  //
  // Phase 19: newEnquiries is scoped to the caller's own clients for a
  // Sales Executive, via the client relation — never Enquiry.assignedToId.

  async getSummary(
    currentUser: CurrentUser,
    query: AnalyticsSummaryQueryDto,
  ): Promise<SafeAnalyticsSummary> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const createdAt = this.createdAtFilter(query.from, query.to);

    // Sales Executive ownership rule (Phase 19): scoped to enquiries
    // belonging to the caller's own clients. Revenue/win-rate/average-deal
    // figures are not computed here at all — the frontend reads those
    // directly from /sales/*, which is already scoped (Phase 8 decision).
    const newEnquiries = await prisma.enquiry.count({
      where: {
        organizationId,
        ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
    });

    return {
      period: {
        from: query.from ? new Date(query.from) : null,
        to: query.to ? new Date(query.to) : null,
        basis: 'ENQUIRY_CREATED_AT',
      },
      newEnquiries,
      unavailableMetrics: this.unavailableMetrics(),
    };
  }

  private unavailableMetrics(): SafeAnalyticsUnavailableMetric[] {
    return [
      {
        key: 'cac',
        label: 'Customer Acquisition Cost',
        reason: 'No marketing spend or acquisition cost data is recorded anywhere in the database.',
      },
      {
        key: 'salesVelocity',
        label: 'Sales Velocity',
        reason:
          'No won/lost timestamp is recorded on an enquiry — a stage change writes only the stage — so the time it takes to close cannot be derived.',
      },
    ];
  }

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view analytics.');
    }
  }

  private createdAtFilter(
    from: string | undefined,
    to: string | undefined,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
}
