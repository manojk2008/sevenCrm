import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { TaxRateStatus, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { UpdateTaxRateStatusDto } from './dto/update-tax-rate-status.dto';
import { ListTaxRatesQueryDto } from './dto/list-tax-rates-query.dto';

type CurrentUser = AppSession['user'];

type TaxRateRow = Prisma.TaxRateGetPayload<Record<string, never>>;

export interface SafeTaxRate {
  id: string;
  organizationId: string;
  name: string;
  rate: number;
  isDefault: boolean;
  status: TaxRateStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTaxRates {
  data: SafeTaxRate[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class TaxRatesService {
  private readonly logger = new Logger(TaxRatesService.name);

  async create(
    dto: CreateTaxRateDto,
    currentUser: CurrentUser,
  ): Promise<SafeTaxRate> {
    this.assertCanManage(currentUser);

    try {
      const created = dto.isDefault
        ? await prisma.$transaction(async (tx) => {
            // At most one ACTIVE default per organization (decision log
            // item 5) — unset any existing default first, in the same
            // transaction as the create, so a concurrent request can never
            // observe two defaults at once.
            await tx.taxRate.updateMany({
              where: {
                organizationId: currentUser.organizationId,
                isDefault: true,
              },
              data: { isDefault: false },
            });
            return tx.taxRate.create({
              data: {
                organizationId: currentUser.organizationId,
                name: dto.name,
                rate: dto.rate,
                isDefault: true,
                status: TaxRateStatus.ACTIVE,
              },
            });
          })
        : await prisma.taxRate.create({
            data: {
              organizationId: currentUser.organizationId,
              name: dto.name,
              rate: dto.rate,
              isDefault: false,
              status: TaxRateStatus.ACTIVE,
            },
          });
      return this.toSafeTaxRate(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListTaxRatesQueryDto,
  ): Promise<PaginatedTaxRates> {
    this.assertCanRead(currentUser);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.TaxRateWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.taxRate.findMany({
        where,
        // Default first, then alphabetical — the common reason to list tax
        // rates is "what should prefill a new quotation line", so the
        // default (if any) belongs at the top.
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.taxRate.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeTaxRate(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(
    id: string,
    currentUser: CurrentUser,
  ): Promise<SafeTaxRate> {
    this.assertCanRead(currentUser);
    const rate = await this.getOrgTaxRateOrThrow(
      id,
      currentUser.organizationId,
    );
    return this.toSafeTaxRate(rate);
  }

  async update(
    id: string,
    dto: UpdateTaxRateDto,
    currentUser: CurrentUser,
  ): Promise<SafeTaxRate> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgTaxRateOrThrow(
      id,
      currentUser.organizationId,
    );

    try {
      const updated = dto.isDefault
        ? await prisma.$transaction(async (tx) => {
            await tx.taxRate.updateMany({
              where: {
                organizationId: currentUser.organizationId,
                isDefault: true,
                id: { not: existing.id },
              },
              data: { isDefault: false },
            });
            return tx.taxRate.update({
              where: { id: existing.id },
              data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
                isDefault: true,
              },
            });
          })
        : await prisma.taxRate.update({
            where: { id: existing.id },
            data: {
              ...(dto.name !== undefined ? { name: dto.name } : {}),
              ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
              ...(dto.isDefault !== undefined
                ? { isDefault: dto.isDefault }
                : {}),
            },
          });
      return this.toSafeTaxRate(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateTaxRateStatusDto,
    currentUser: CurrentUser,
  ): Promise<SafeTaxRate> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgTaxRateOrThrow(
      id,
      currentUser.organizationId,
    );

    const deactivating = dto.status === TaxRateStatus.INACTIVE;
    const updated = await prisma.taxRate.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        // An INACTIVE rate can never be "the" default — deactivating the
        // current default clears it rather than leaving a dangling
        // isDefault=true on a rate that can no longer prefill anything.
        // Reactivating never re-sets it: the org must explicitly choose a
        // new default afterward, same as it would for any other rate.
        ...(deactivating && existing.isDefault ? { isDefault: false } : {}),
      },
    });
    return this.toSafeTaxRate(updated);
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Mirrors ProductGroup/Quotation: all three roles get read, only
  // SUPER_ADMIN/ADMIN may create/update/change status (Phase 17 decision
  // log item 2) — Sales Executive is read-only, backend-enforced.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException(
        'You do not have permission to view tax rates.',
      );
    }
  }

  private assertCanManage(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only a Super Admin or Admin can manage tax rates.',
      );
    }
  }

  private async getOrgTaxRateOrThrow(
    id: string,
    organizationId: string,
  ): Promise<TaxRateRow> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so a tax rate belonging to another org behaves as NOT FOUND, not 403,
    // and never leaks whether the id exists elsewhere.
    const rate = await prisma.taxRate.findFirst({
      where: { id, organizationId },
    });
    if (!rate) {
      throw new NotFoundException('Tax rate not found.');
    }
    return rate;
  }

  private mapWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A tax rate with this name already exists in your organization.',
      );
    }
    this.logger.error('Unexpected error writing tax rate', error as Error);
    throw new InternalServerErrorException('Failed to save tax rate.');
  }

  private toSafeTaxRate(rate: TaxRateRow): SafeTaxRate {
    return {
      id: rate.id,
      organizationId: rate.organizationId,
      name: rate.name,
      rate: Number(rate.rate),
      isDefault: rate.isDefault,
      status: rate.status,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }
}
