import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../auth/auth';
import { UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

type CurrentUser = AppSession['user'];

interface RawOrganization {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeOrganization {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrganizationsService {
  async findMine(currentUser: CurrentUser): Promise<SafeOrganization> {
    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
    return this.toSafeOrganization(organization);
  }

  async updateMine(dto: UpdateOrganizationDto, currentUser: CurrentUser): Promise<SafeOrganization> {
    this.assertCanEdit(currentUser);

    const updated = await prisma.organization.update({
      where: { id: currentUser.organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.gstNumber !== undefined ? { gstNumber: dto.gstNumber } : {}),
      },
    });
    return this.toSafeOrganization(updated);
  }

  private assertCanEdit(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can edit company settings.');
    }
  }

  private toSafeOrganization(organization: RawOrganization): SafeOrganization {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      address: organization.address,
      phone: organization.phone,
      email: organization.email,
      website: organization.website,
      gstNumber: organization.gstNumber,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}
