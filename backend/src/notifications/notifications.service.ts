import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { DashboardService, type SafeActivity } from '../dashboard/dashboard.service';
import { NotificationsQueryDto } from './dto/notifications-query.dto';

type CurrentUser = AppSession['user'];

const DEFAULT_NOTIFICATIONS_LIMIT = 10;

export type SafeNotificationType =
  | 'CLIENT_CREATED'
  | 'ENQUIRY_CREATED'
  | 'QUOTATION_CREATED'
  | 'FOLLOW_UP_COMPLETED';

export interface SafeNotification {
  /** Deterministic — event-type + underlying record id (see DashboardService.getRecentActivity). Never Math.random()/cuid-at-request-time. */
  id: string;
  type: SafeNotificationType;
  title: string;
  description: string;
  timestamp: Date;
  /**
   * A real, existing frontend route, or null when no safe destination
   * exists. Client and Quotation have a real detail page (`/clients/:id`,
   * `/quotations/:id`); Enquiry and FollowUp do not (their detail views are
   * in-page panels on the list route, not a distinct URL), so those link to
   * the real list page rather than a fabricated detail route.
   */
  href: string;
}

export interface SafeNotificationFeed {
  notifications: SafeNotification[];
}

@Injectable()
export class NotificationsService {
  // Notifications is a read-only presentation layer over Dashboard's
  // Recent Activity feed — it owns no table, writes nothing, and invents no
  // event type Recent Activity doesn't already have. Phase 9 is explicitly
  // stateless: no read/unread persistence, no PATCH route.
  constructor(private readonly dashboardService: DashboardService) {}

  async getNotifications(
    currentUser: CurrentUser,
    query: NotificationsQueryDto,
  ): Promise<SafeNotificationFeed> {
    this.assertCanRead(currentUser);
    const limit = query.limit ?? DEFAULT_NOTIFICATIONS_LIMIT;

    // getRecentActivity already does org-scoping, merge, and newest-first
    // sort across Client/Enquiry/Quotation/FollowUp — reused verbatim rather
    // than re-implemented (it also re-checks assertCanRead, harmlessly).
    const { activities } = await this.dashboardService.getRecentActivity(currentUser, { limit });

    return { notifications: activities.map((activity) => this.toNotification(activity)) };
  }

  private toNotification(activity: SafeActivity): SafeNotification {
    switch (activity.type) {
      case 'CLIENT_CREATED':
        return {
          id: activity.id,
          type: activity.type,
          title: 'New Client',
          description: `${activity.companyName} was added as a client.`,
          timestamp: activity.occurredAt,
          href: `/clients/${activity.clientId}`,
        };
      case 'ENQUIRY_CREATED':
        return {
          id: activity.id,
          type: activity.type,
          title: 'New Enquiry',
          description: `${activity.title} — ${activity.clientName}`,
          timestamp: activity.occurredAt,
          href: '/enquiries',
        };
      case 'QUOTATION_CREATED':
        return {
          id: activity.id,
          type: activity.type,
          title: 'Quotation Raised',
          description: `${activity.quotationNumber} raised for ${activity.clientName}`,
          timestamp: activity.occurredAt,
          href: `/quotations/${activity.quotationId}`,
        };
      case 'FOLLOW_UP_COMPLETED':
        return {
          id: activity.id,
          type: activity.type,
          title: 'Follow-up Completed',
          description: `${activity.subject} — ${activity.clientName}`,
          timestamp: activity.occurredAt,
          href: '/follow-ups',
        };
    }
  }

  // Same three readable roles as every completed module. No write routes
  // exist for a manage-tier check to guard.
  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view notifications.');
    }
  }
}
