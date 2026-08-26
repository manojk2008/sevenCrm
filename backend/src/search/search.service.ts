import { ForbiddenException, Injectable } from '@nestjs/common';
import { prisma } from '../auth/auth';
import type { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { SearchQueryDto } from './dto/search-query.dto';

type CurrentUser = AppSession['user'];

/**
 * Results per entity type, not a caller-controlled limit — this is a
 * lightweight composed search (Phase 10), not a paginated list. Capping each
 * source keeps the combined response bounded (at most 4 * RESULTS_PER_TYPE)
 * without needing a `limit`/`page` query parameter.
 */
const RESULTS_PER_TYPE = 5;

export type SafeSearchResultType = 'client' | 'enquiry' | 'product' | 'quotation';

export interface SafeSearchResult {
  id: string;
  type: SafeSearchResultType;
  title: string;
  description: string;
  /**
   * A real, existing frontend route — never fabricated. Client and
   * Quotation have a real detail page (`/clients/:id`, `/quotations/:id`).
   * Enquiry and Product do not (confirmed during the Phase 10 inspection —
   * no `/enquiries/:id` or `/products/:id` route exists), so those results
   * link to the real list page instead of an invented detail URL.
   */
  href: string;
}

export interface SafeSearchResponse {
  query: string;
  results: SafeSearchResult[];
}

@Injectable()
export class SearchService {
  // Search is a read-only composed view over Client / Enquiry / Product /
  // Quotation — it owns no table and writes nothing. Each source query below
  // mirrors the exact search-field convention that module's own list
  // endpoint already established (ClientsService/EnquiriesService/
  // QuotationsService `search` filters), so results are never a mismatched
  // second definition of "matches this query" for the same entity.
  // Follow-ups are deliberately NOT searched: they have no detail route
  // either, and adding a fifth parallel query for another list-only result
  // would expand scope without adding a reachable destination Search
  // doesn't already offer via Enquiries (Phase 10 decision).
  //
  // Phase 19: for a Sales Executive, Client/Enquiry/Quotation results are
  // scoped to their own clients (directly on Client, via the client
  // relation on Enquiry/Quotation) — Products remain organization-wide.

  async search(currentUser: CurrentUser, query: SearchQueryDto): Promise<SafeSearchResponse> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const q = query.q;
    // Sales Executive ownership rule (Phase 19): additive to organizationId
    // for Clients/Enquiries/Quotations — Products stay organization-wide.
    const clientFilter = isSalesExec ? { assignedToId: currentUser.id } : {};
    const relatedClientFilter = isSalesExec ? { client: { assignedToId: currentUser.id } } : {};

    const [clients, enquiries, products, quotations] = await Promise.all([
      this.searchClients(organizationId, q, clientFilter),
      this.searchEnquiries(organizationId, q, relatedClientFilter),
      this.searchProducts(organizationId, q),
      this.searchQuotations(organizationId, q, relatedClientFilter),
    ]);

    return { query: q, results: [...clients, ...enquiries, ...products, ...quotations] };
  }

  private async searchClients(
    organizationId: string,
    q: string,
    ownershipFilter: Prisma.ClientWhereInput,
  ): Promise<SafeSearchResult[]> {
    const rows = await prisma.client.findMany({
      where: {
        organizationId,
        ...ownershipFilter,
        OR: [
          { companyName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, companyName: true, industry: true, email: true },
      orderBy: { companyName: 'asc' },
      take: RESULTS_PER_TYPE,
    });
    return rows.map((c) => ({
      id: c.id,
      type: 'client' as const,
      title: c.companyName,
      description: `${c.industry} — ${c.email}`,
      href: `/clients/${c.id}`,
    }));
  }

  private async searchEnquiries(
    organizationId: string,
    q: string,
    ownershipFilter: Prisma.EnquiryWhereInput,
  ): Promise<SafeSearchResult[]> {
    const rows = await prisma.enquiry.findMany({
      where: {
        organizationId,
        ...ownershipFilter,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { client: { companyName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        title: true,
        stage: true,
        client: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: RESULTS_PER_TYPE,
    });
    return rows.map((e) => ({
      id: e.id,
      type: 'enquiry' as const,
      title: e.title,
      description: `${e.client.companyName} — ${e.stage}`,
      // No per-enquiry detail route exists — see the class comment above.
      href: '/enquiries',
    }));
  }

  private async searchProducts(organizationId: string, q: string): Promise<SafeSearchResult[]> {
    const rows = await prisma.product.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { productGroup: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        productGroup: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: RESULTS_PER_TYPE,
    });
    return rows.map((p) => ({
      id: p.id,
      type: 'product' as const,
      title: p.name,
      description: p.sku ? `${p.productGroup.name} — ${p.sku}` : p.productGroup.name,
      // No per-product detail route exists — see the class comment above.
      href: '/products',
    }));
  }

  private async searchQuotations(
    organizationId: string,
    q: string,
    ownershipFilter: Prisma.QuotationWhereInput,
  ): Promise<SafeSearchResult[]> {
    const rows = await prisma.quotation.findMany({
      where: {
        organizationId,
        ...ownershipFilter,
        OR: [
          { quotationNumber: { contains: q, mode: 'insensitive' } },
          { client: { companyName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        client: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: RESULTS_PER_TYPE,
    });
    return rows.map((qt) => ({
      id: qt.id,
      type: 'quotation' as const,
      title: qt.quotationNumber,
      description: `${qt.client.companyName} — ${qt.status}`,
      href: `/quotations/${qt.id}`,
    }));
  }

  // Same three readable roles as every completed module. No write routes
  // exist for a manage-tier check to guard.
  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to search.');
    }
  }
}
