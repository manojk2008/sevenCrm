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
import { ProductGroupStatus, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateProductGroupDto } from './dto/create-product-group.dto';
import { UpdateProductGroupDto } from './dto/update-product-group.dto';
import { UpdateProductGroupStatusDto } from './dto/update-product-group-status.dto';
import { ListProductGroupsQueryDto } from './dto/list-product-groups-query.dto';

type CurrentUser = AppSession['user'];

const PRODUCT_GROUP_INCLUDE = {
  _count: { select: { products: true } },
} satisfies Prisma.ProductGroupInclude;

type ProductGroupWithCount = Prisma.ProductGroupGetPayload<{ include: typeof PRODUCT_GROUP_INCLUDE }>;

export interface SafeProductGroup {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: ProductGroupStatus;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedProductGroups {
  data: SafeProductGroup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ProductGroupsService {
  private readonly logger = new Logger(ProductGroupsService.name);

  async create(dto: CreateProductGroupDto, currentUser: CurrentUser): Promise<SafeProductGroup> {
    this.assertCanManage(currentUser);

    try {
      const created = await prisma.productGroup.create({
        data: {
          organizationId: currentUser.organizationId,
          name: dto.name,
          description: dto.description,
          status: ProductGroupStatus.ACTIVE,
        },
        include: PRODUCT_GROUP_INCLUDE,
      });
      return this.toSafeProductGroup(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListProductGroupsQueryDto,
  ): Promise<PaginatedProductGroups> {
    this.assertCanRead(currentUser);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.ProductGroupWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.productGroup.findMany({
        where,
        include: PRODUCT_GROUP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.productGroup.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeProductGroup(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeProductGroup> {
    this.assertCanRead(currentUser);
    const group = await this.getOrgProductGroupOrThrow(id, currentUser.organizationId);
    return this.toSafeProductGroup(group);
  }

  async update(id: string, dto: UpdateProductGroupDto, currentUser: CurrentUser): Promise<SafeProductGroup> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgProductGroupOrThrow(id, currentUser.organizationId);

    try {
      const updated = await prisma.productGroup.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        include: PRODUCT_GROUP_INCLUDE,
      });
      return this.toSafeProductGroup(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateProductGroupStatusDto,
    currentUser: CurrentUser,
  ): Promise<SafeProductGroup> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgProductGroupOrThrow(id, currentUser.organizationId);

    // Deactivating a group never touches its Products (approved Phase 5B
    // decision — no cascading status change, existing products keep
    // whatever status they already had). Only the group's own row changes.
    const updated = await prisma.productGroup.update({
      where: { id: existing.id },
      data: { status: dto.status },
      include: PRODUCT_GROUP_INCLUDE,
    });
    return this.toSafeProductGroup(updated);
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Unlike Clients/Enquiries (all three roles get organization-wide
  // read/create/update), Product Groups are approved as SUPER_ADMIN/ADMIN
  // manage, SALES_EXECUTIVE read-only — matching the frontend's
  // src/constants/roles.ts VIEW_ONLY entry for products, which Clients and
  // Enquiries do not have.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view product groups.');
    }
  }

  private assertCanManage(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can manage product groups.');
    }
  }

  private async getOrgProductGroupOrThrow(
    id: string,
    organizationId: string,
  ): Promise<ProductGroupWithCount> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so a product group belonging to another org behaves as NOT FOUND,
    // not 403, and never leaks whether the id exists elsewhere.
    const group = await prisma.productGroup.findFirst({
      where: { id, organizationId },
      include: PRODUCT_GROUP_INCLUDE,
    });
    if (!group) {
      throw new NotFoundException('Product group not found.');
    }
    return group;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A product group with this name already exists in your organization.');
    }
    this.logger.error('Unexpected error writing product group', error as Error);
    throw new InternalServerErrorException('Failed to save product group.');
  }

  private toSafeProductGroup(group: ProductGroupWithCount): SafeProductGroup {
    return {
      id: group.id,
      organizationId: group.organizationId,
      name: group.name,
      description: group.description,
      status: group.status,
      productCount: group._count.products,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
