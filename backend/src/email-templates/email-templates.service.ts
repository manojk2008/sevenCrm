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
import { EmailTemplateKey, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

type CurrentUser = AppSession['user'];

type EmailTemplateRow = Prisma.EmailTemplateGetPayload<Record<string, never>>;

export interface SafeEmailTemplate {
  id: string;
  organizationId: string;
  key: EmailTemplateKey;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  async create(
    dto: CreateEmailTemplateDto,
    currentUser: CurrentUser,
  ): Promise<SafeEmailTemplate> {
    this.assertCanManage(currentUser);

    try {
      const created = await prisma.emailTemplate.create({
        data: {
          organizationId: currentUser.organizationId,
          key: dto.key,
          subject: dto.subject,
          body: dto.body,
        },
      });
      return this.toSafeEmailTemplate(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // No pagination — this is a small, closed set (at most one row per
  // EmailTemplateKey value, currently 3) rather than an open-ended list,
  // unlike every other findAllForOrg in this codebase.
  async findAllForOrg(currentUser: CurrentUser): Promise<SafeEmailTemplate[]> {
    this.assertCanRead(currentUser);
    const rows = await prisma.emailTemplate.findMany({
      where: { organizationId: currentUser.organizationId },
      orderBy: { key: 'asc' },
    });
    return rows.map((row) => this.toSafeEmailTemplate(row));
  }

  async findOneForOrg(
    id: string,
    currentUser: CurrentUser,
  ): Promise<SafeEmailTemplate> {
    this.assertCanRead(currentUser);
    const template = await this.getOrgTemplateOrThrow(
      id,
      currentUser.organizationId,
    );
    return this.toSafeEmailTemplate(template);
  }

  async update(
    id: string,
    dto: UpdateEmailTemplateDto,
    currentUser: CurrentUser,
  ): Promise<SafeEmailTemplate> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgTemplateOrThrow(
      id,
      currentUser.organizationId,
    );

    try {
      const updated = await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          ...(dto.key !== undefined ? { key: dto.key } : {}),
          ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
        },
      });
      return this.toSafeEmailTemplate(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Unlike Tax Rates/Branding (SALES_EXECUTIVE read-only), Email Templates
  // are internal admin content with no reason for Sales Executive access —
  // Phase 17 decision log item 13: SALES_EXECUTIVE gets no access at all,
  // not even read.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to view email templates.',
      );
    }
  }

  private assertCanManage(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only a Super Admin or Admin can manage email templates.',
      );
    }
  }

  private async getOrgTemplateOrThrow(
    id: string,
    organizationId: string,
  ): Promise<EmailTemplateRow> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so a template belonging to another org behaves as NOT FOUND, not 403,
    // and never leaks whether the id exists elsewhere.
    const template = await prisma.emailTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) {
      throw new NotFoundException('Email template not found.');
    }
    return template;
  }

  private mapWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A template for this key already exists in your organization.',
      );
    }
    this.logger.error(
      'Unexpected error writing email template',
      error as Error,
    );
    throw new InternalServerErrorException('Failed to save email template.');
  }

  private toSafeEmailTemplate(template: EmailTemplateRow): SafeEmailTemplate {
    return {
      id: template.id,
      organizationId: template.organizationId,
      key: template.key,
      subject: template.subject,
      body: template.body,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
