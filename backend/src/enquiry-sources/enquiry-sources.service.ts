import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateEnquirySourceDto } from './dto/create-enquiry-source.dto';
import { ListEnquirySourcesQueryDto } from './dto/list-enquiry-sources-query.dto';

type CurrentUser = AppSession['user'];

type EnquirySourceRow = Prisma.EnquirySourceGetPayload<Record<string, never>>;

export interface SafeEnquirySource {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EnquirySourcesService {
  private readonly logger = new Logger(EnquirySourcesService.name);

  async create(
    dto: CreateEnquirySourceDto,
    currentUser: CurrentUser,
  ): Promise<SafeEnquirySource> {
    this.assertCanCreate(currentUser);

    const name = dto.name.trim();
    // @MinLength(1) on the DTO already rejects an empty string, but not a
    // whitespace-only one — the trim check here closes that gap, same
    // pattern as EnquiriesService.assertLostReasonPresent.
    if (name.length === 0) {
      throw new ConflictException('Source name cannot be blank.');
    }

    // Explicit case-insensitive existence check before the write, rather
    // than relying solely on the database's case-sensitive unique index —
    // this is what lets a caller who types "google ads" against an existing
    // "Google Ads" get a clean, specific message (and the existing row)
    // instead of a raw constraint violation. The unique index remains the
    // backstop for a concurrent create of the exact same casing.
    const existing = await prisma.enquirySource.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        `A source named "${existing.name}" already exists in your organization.`,
      );
    }

    try {
      const created = await prisma.enquirySource.create({
        data: {
          organizationId: currentUser.organizationId,
          name,
        },
      });
      return this.toSafeEnquirySource(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListEnquirySourcesQueryDto,
  ): Promise<SafeEnquirySource[]> {
    this.assertCanRead(currentUser);

    const rows = await prisma.enquirySource.findMany({
      where: {
        organizationId: currentUser.organizationId,
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      // Alphabetical: this list populates a Select, not a management table,
      // so the most useful order is the one a user can scan for a name in —
      // not creation order.
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => this.toSafeEnquirySource(row));
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Mirrors EnquiriesService: all three roles may read and create — a lead
  // source is ordinary data every Sales Executive enters while logging an
  // enquiry, not an admin-only settings concept like TaxRate/ProductGroup.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException(
        'You do not have permission to view enquiry sources.',
      );
    }
  }

  private assertCanCreate(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException(
        'You do not have permission to create enquiry sources.',
      );
    }
  }

  private hasCrmAccess(currentUser: CurrentUser): boolean {
    return (
      currentUser.crmRole === UserRole.SUPER_ADMIN ||
      currentUser.crmRole === UserRole.ADMIN ||
      currentUser.crmRole === UserRole.SALES_EXECUTIVE
    );
  }

  private mapWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Reachable only on a concurrent create of the exact same name/casing
      // that raced past the pre-check above — the pre-check already covers
      // the ordinary case with a friendlier message.
      throw new ConflictException(
        'A source with this name already exists in your organization.',
      );
    }
    this.logger.error(
      'Unexpected error writing enquiry source',
      error as Error,
    );
    throw new InternalServerErrorException('Failed to save source.');
  }

  private toSafeEnquirySource(source: EnquirySourceRow): SafeEnquirySource {
    return {
      id: source.id,
      organizationId: source.organizationId,
      name: source.name,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }
}
