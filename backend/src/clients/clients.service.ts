import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { ClientStatus, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientStatusDto } from './dto/update-client-status.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';

type CurrentUser = AppSession['user'];

const CLIENT_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  contacts: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ClientInclude;

type ClientWithRelations = Prisma.ClientGetPayload<{ include: typeof CLIENT_INCLUDE }>;

export interface SafeClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeClient {
  id: string;
  organizationId: string;
  companyName: string;
  industry: string;
  website: string | null;
  email: string;
  phone: string;
  gstNumber: string | null;
  status: ClientStatus;
  churnReason: string | null;
  tags: string[];
  notes: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  totalDeals: number;
  totalRevenue: number;
  assignedTo: { id: string; name: string; email: string } | null;
  contacts: SafeClientContact[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedClients {
  data: SafeClient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  async create(dto: CreateClientDto, currentUser: CurrentUser): Promise<SafeClient> {
    this.assertCanCreate(currentUser);
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    // Sales Executive ownership rule (Phase 19): a Sales Executive may only
    // ever own their own clients — an omitted assignedToId is forced to
    // themselves, and any other explicit value is rejected outright rather
    // than silently rewritten. SUPER_ADMIN/ADMIN are unaffected.
    let assignedToId: string | null;
    if (isSalesExec) {
      if (dto.assignedToId !== undefined && dto.assignedToId !== currentUser.id) {
        throw new BadRequestException('You can only create clients assigned to yourself.');
      }
      assignedToId = currentUser.id;
    } else {
      if (dto.assignedToId) {
        await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
      }
      assignedToId = dto.assignedToId ?? null;
    }

    try {
      const created = await prisma.client.create({
        data: {
          organizationId: currentUser.organizationId,
          companyName: dto.companyName,
          industry: dto.industry,
          website: dto.website,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          gstNumber: dto.gstNumber,
          tags: dto.tags ?? [],
          notes: dto.notes,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          addressCity: dto.addressCity,
          addressState: dto.addressState,
          addressPincode: dto.addressPincode,
          addressCountry: dto.addressCountry ?? 'India',
          assignedToId,
          status: ClientStatus.ACTIVE,
          totalDeals: 0,
          totalRevenue: 0,
        },
        include: CLIENT_INCLUDE,
      });
      return this.toSafeClient(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(currentUser: CurrentUser, query: ListClientsQueryDto): Promise<PaginatedClients> {
    this.assertCanRead(currentUser);
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.ClientWhereInput = {
      organizationId: currentUser.organizationId,
      // Sales Executive ownership rule (Phase 19): additive to the
      // organizationId filter above, never a replacement of it.
      ...(isSalesExec ? { assignedToId: currentUser.id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: CLIENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.client.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeClient(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeClient> {
    this.assertCanRead(currentUser);
    const client = await this.getOrgClientOrThrow(id, currentUser);
    return this.toSafeClient(client);
  }

  async update(id: string, dto: UpdateClientDto, currentUser: CurrentUser): Promise<SafeClient> {
    this.assertCanUpdate(currentUser);
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const existing = await this.getOrgClientOrThrow(id, currentUser);

    // Sales Executive ownership rule (Phase 19): cannot remove their own
    // assignment (dto.assignedToId === null) and cannot reassign to anyone
    // else — the only value that passes is their own id, or leaving the
    // field untouched (undefined). SUPER_ADMIN/ADMIN are unaffected.
    if (isSalesExec) {
      if (dto.assignedToId !== undefined && dto.assignedToId !== currentUser.id) {
        throw new BadRequestException('You cannot reassign or remove your own client assignment.');
      }
    } else if (dto.assignedToId !== undefined && dto.assignedToId !== null) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }

    try {
      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: {
          ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
          ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
          ...(dto.website !== undefined ? { website: dto.website } : {}),
          ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.gstNumber !== undefined ? { gstNumber: dto.gstNumber } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1 } : {}),
          ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 } : {}),
          ...(dto.addressCity !== undefined ? { addressCity: dto.addressCity } : {}),
          ...(dto.addressState !== undefined ? { addressState: dto.addressState } : {}),
          ...(dto.addressPincode !== undefined ? { addressPincode: dto.addressPincode } : {}),
          ...(dto.addressCountry !== undefined ? { addressCountry: dto.addressCountry } : {}),
          ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
        },
        include: CLIENT_INCLUDE,
      });
      return this.toSafeClient(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(id: string, dto: UpdateClientStatusDto, currentUser: CurrentUser): Promise<SafeClient> {
    this.assertCanManageStatus(currentUser);
    const existing = await this.getOrgClientOrThrow(id, currentUser);

    const data: Prisma.ClientUpdateInput = { status: dto.status };
    if (dto.status === ClientStatus.INACTIVE) {
      // DTO validation (ValidateIf) already guarantees churnReason is a
      // non-empty string whenever status is INACTIVE.
      data.churnReason = dto.churnReason;
    }
    // Reactivating (-> ACTIVE) intentionally leaves churnReason untouched:
    // it's preserved as history of the prior deactivation, not cleared.

    const updated = await prisma.client.update({ where: { id: existing.id }, data, include: CLIENT_INCLUDE });
    return this.toSafeClient(updated);
  }

  async listContacts(clientId: string, currentUser: CurrentUser): Promise<SafeClientContact[]> {
    this.assertCanRead(currentUser);
    const client = await this.getOrgClientOrThrow(clientId, currentUser);
    return client.contacts;
  }

  async createContact(
    clientId: string,
    dto: CreateClientContactDto,
    currentUser: CurrentUser,
  ): Promise<SafeClientContact> {
    this.assertCanManageContacts(currentUser);
    await this.getOrgClientOrThrow(clientId, currentUser);

    return prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.clientContact.create({
        data: {
          clientId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          designation: dto.designation,
          isPrimary: dto.isPrimary ?? false,
        },
      });
    });
  }

  async updateContact(
    clientId: string,
    contactId: string,
    dto: UpdateClientContactDto,
    currentUser: CurrentUser,
  ): Promise<SafeClientContact> {
    this.assertCanManageContacts(currentUser);
    await this.getOrgClientOrThrow(clientId, currentUser);
    await this.getClientContactOrThrow(clientId, contactId);

    return prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.clientContact.updateMany({
          where: { clientId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }
      return tx.clientContact.update({
        where: { id: contactId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        },
      });
    });
  }

  async deleteContact(
    clientId: string,
    contactId: string,
    currentUser: CurrentUser,
  ): Promise<{ id: string }> {
    this.assertCanManageContacts(currentUser);
    await this.getOrgClientOrThrow(clientId, currentUser);
    await this.getClientContactOrThrow(clientId, contactId);

    await prisma.clientContact.delete({ where: { id: contactId } });
    return { id: contactId };
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Sales Executives read/create/update within the same three-role gate as
  // Admins, but (Phase 19) are additionally scoped to clients assigned to
  // themselves: findAllForOrg/getOrgClientOrThrow add an assignedToId
  // filter, create() forces assignedToId to the caller, and update() blocks
  // reassigning or unassigning their own client. Client ownership is the
  // authoritative visibility boundary for every related CRM record
  // (Enquiries/Quotations/Follow-ups) — see those services' own
  // authorization comments.
  //
  // Status changes and contact management are deliberately narrower,
  // restricted to SUPER_ADMIN/ADMIN: deactivating a client is this CRM's
  // stand-in for "delete", and the (currently inert) frontend permission
  // matrix at src/constants/roles.ts already encodes
  // `sales-executive.clients.delete = false`, which this mirrors.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view clients.');
    }
  }

  private assertCanCreate(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to create clients.');
    }
  }

  private assertCanUpdate(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to update clients.');
    }
  }

  private assertCanManageStatus(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can change a client\'s status.');
    }
  }

  private assertCanManageContacts(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can manage client contacts.');
    }
  }

  private async assertAssignedUserInOrg(assignedToId: string, organizationId: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: assignedToId, organizationId } });
    if (!user) {
      throw new BadRequestException('assignedToId must reference a user in your organization.');
    }
  }

  private async getOrgClientOrThrow(id: string, currentUser: CurrentUser): Promise<ClientWithRelations> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so a client belonging to another org behaves as NOT FOUND, not 403,
    // and never leaks whether the id exists elsewhere. The Sales Executive
    // ownership condition (Phase 19) is additive to that same WHERE clause
    // for the same reason: another rep's client (or an unassigned one)
    // behaves as NOT FOUND, never a 403 that would confirm it exists.
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const client = await prisma.client.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        ...(isSalesExec ? { assignedToId: currentUser.id } : {}),
      },
      include: CLIENT_INCLUDE,
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }
    return client;
  }

  private async getClientContactOrThrow(clientId: string, contactId: string) {
    // clientId is already verified to belong to the caller's org by
    // getOrgClientOrThrow before this runs, so scoping the contact lookup
    // to that clientId is sufficient to keep it tenant-safe.
    const contact = await prisma.clientContact.findFirst({ where: { id: contactId, clientId } });
    if (!contact) {
      throw new NotFoundException('Contact not found.');
    }
    return contact;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('email')) {
        throw new ConflictException('A client with this email already exists in your organization.');
      }
      if (target.includes('gstNumber')) {
        throw new ConflictException('A client with this GST number already exists in your organization.');
      }
      throw new ConflictException('A client with these details already exists in your organization.');
    }
    this.logger.error('Unexpected error writing client', error as Error);
    throw new InternalServerErrorException('Failed to save client.');
  }

  private toSafeClient(client: ClientWithRelations): SafeClient {
    return {
      id: client.id,
      organizationId: client.organizationId,
      companyName: client.companyName,
      industry: client.industry,
      website: client.website,
      email: client.email,
      phone: client.phone,
      gstNumber: client.gstNumber,
      status: client.status,
      churnReason: client.churnReason,
      tags: client.tags,
      notes: client.notes,
      address: {
        line1: client.addressLine1,
        line2: client.addressLine2,
        city: client.addressCity,
        state: client.addressState,
        pincode: client.addressPincode,
        country: client.addressCountry,
      },
      totalDeals: client.totalDeals,
      totalRevenue: Number(client.totalRevenue),
      assignedTo: client.assignedTo,
      contacts: client.contacts,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}
