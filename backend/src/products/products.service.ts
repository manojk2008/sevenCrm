import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { ProductGroupStatus, ProductStatus, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

type CurrentUser = AppSession['user'];

const PRODUCT_INCLUDE = {
  productGroup: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

export interface SafeProduct {
  id: string;
  organizationId: string;
  productGroupId: string;
  productGroup: { id: string; name: string };
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  unit: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedProducts {
  data: SafeProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  async create(dto: CreateProductDto, currentUser: CurrentUser): Promise<SafeProduct> {
    this.assertCanManage(currentUser);
    await this.assertProductGroupUsable(dto.productGroupId, currentUser.organizationId);

    try {
      const created = await prisma.product.create({
        data: {
          organizationId: currentUser.organizationId,
          productGroupId: dto.productGroupId,
          name: dto.name,
          description: dto.description,
          price: new Prisma.Decimal(dto.price),
          sku: dto.sku,
          unit: dto.unit,
          status: ProductStatus.ACTIVE,
        },
        include: PRODUCT_INCLUDE,
      });
      return this.toSafeProduct(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(currentUser: CurrentUser, query: ListProductsQueryDto): Promise<PaginatedProducts> {
    this.assertCanRead(currentUser);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.ProductWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.productGroupId ? { productGroupId: query.productGroupId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeProduct(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeProduct> {
    this.assertCanRead(currentUser);
    const product = await this.getOrgProductOrThrow(id, currentUser.organizationId);
    return this.toSafeProduct(product);
  }

  async update(id: string, dto: UpdateProductDto, currentUser: CurrentUser): Promise<SafeProduct> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgProductOrThrow(id, currentUser.organizationId);

    if (dto.productGroupId !== undefined) {
      await this.assertProductGroupUsable(dto.productGroupId, currentUser.organizationId);
    }

    try {
      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.productGroupId !== undefined ? { productGroupId: dto.productGroupId } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        },
        include: PRODUCT_INCLUDE,
      });
      return this.toSafeProduct(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(id: string, dto: UpdateProductStatusDto, currentUser: CurrentUser): Promise<SafeProduct> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgProductOrThrow(id, currentUser.organizationId);

    // Product status is independent of its group's status — no
    // synchronization either direction (approved Phase 5B decision).
    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: { status: dto.status },
      include: PRODUCT_INCLUDE,
    });
    return this.toSafeProduct(updated);
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Same read/manage split as ProductGroupsService: Sales Executive gets
  // organization-wide read access to the catalog but no write access,
  // matching the frontend's src/constants/roles.ts VIEW_ONLY entry for
  // products (approved for Phase 5B, unlike the Clients/Enquiries default
  // of organization-wide write access for all three roles).
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view products.');
    }
  }

  private assertCanManage(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can manage products.');
    }
  }

  // Verifies productGroupId belongs to the caller's organization (never
  // trusting the FK alone — same precedent as Enquiry.clientId /
  // Client.assignedToId) and that the group is not INACTIVE. Approved
  // Phase 5B rule: a NEW assignment (create, or an update that changes
  // productGroupId) must never attach a product to a group that is no
  // longer accepting them, while products already assigned before
  // deactivation are left untouched (see updateStatus above).
  private async assertProductGroupUsable(productGroupId: string, organizationId: string): Promise<void> {
    const group = await prisma.productGroup.findFirst({ where: { id: productGroupId, organizationId } });
    if (!group) {
      throw new BadRequestException('productGroupId must reference a product group in your organization.');
    }
    if (group.status === ProductGroupStatus.INACTIVE) {
      throw new BadRequestException('Cannot assign a product to an inactive product group.');
    }
  }

  private async getOrgProductOrThrow(id: string, organizationId: string): Promise<ProductWithRelations> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so a product belonging to another org behaves as NOT FOUND, not 403,
    // and never leaks whether the id exists elsewhere.
    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: productGroupId pointed at a row that does not exist. Already
      // pre-validated above, so this is only reachable on a concurrent
      // delete — reported as a 400 rather than surfacing the Prisma
      // constraint name (mirrors EnquiriesService.mapWriteError).
      if (error.code === 'P2003') {
        throw new BadRequestException('Referenced product group no longer exists.');
      }
      // P2025: the product disappeared between the org-scoped read and the
      // write. Reported as 404 to stay consistent with the read path.
      if (error.code === 'P2025') {
        throw new NotFoundException('Product not found.');
      }
    }
    this.logger.error('Unexpected error writing product', error as Error);
    throw new InternalServerErrorException('Failed to save product.');
  }

  private toSafeProduct(product: ProductWithRelations): SafeProduct {
    return {
      id: product.id,
      organizationId: product.organizationId,
      productGroupId: product.productGroupId,
      productGroup: product.productGroup,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      sku: product.sku,
      unit: product.unit,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
