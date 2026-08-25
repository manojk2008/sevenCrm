import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { auth, prisma } from '../auth/auth';
import { UserRole, UserStatus } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

type CurrentUser = AppSession['user'];

interface RawCrmUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: string;
  department: string;
  status: string;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: UserRole;
  department: string;
  status: UserStatus;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async create(dto: CreateUserDto, currentUser: CurrentUser): Promise<SafeUser> {
    this.assertIsSuperAdmin(currentUser, 'create users');

    if (dto.role === UserRole.SUPER_ADMIN) {
      // Documented business rule: this API does not support creating
      // additional Super Admins. Exactly one is provisioned by the
      // backend-only bootstrap script (src/setup/setup-admin.ts).
      throw new BadRequestException(
        'Creating additional Super Admin accounts is not supported through this API.',
      );
    }

    const email = dto.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    let created: Awaited<ReturnType<typeof auth.api.createUser>>;
    try {
      created = await auth.api.createUser({
        body: {
          email,
          name: dto.name,
          password: dto.password,
          // CRM fields ride along as declared `additionalFields` (see
          // src/auth/auth.ts) so Better Auth performs one atomic insert,
          // including password hashing and the credential account. This
          // service never hashes a password or touches the account table.
          data: {
            organizationId: currentUser.organizationId,
            crmRole: dto.role,
            department: dto.department,
            status: dto.status ?? UserStatus.ACTIVE,
            emailVerified: false,
          },
        },
      });
    } catch (error) {
      if (this.isDuplicateEmailError(error)) {
        throw new ConflictException('A user with this email already exists.');
      }
      this.logger.error('Failed to create user via Better Auth', error as Error);
      throw new InternalServerErrorException('Failed to create user.');
    }

    if (!created?.user) {
      throw new InternalServerErrorException('Failed to create user.');
    }

    const finalUser = await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } });
    return this.toSafeUser(finalUser);
  }

  async findAllForOrg(currentUser: CurrentUser): Promise<SafeUser[]> {
    this.assertCanView(currentUser);
    const users = await prisma.user.findMany({
      where: { organizationId: currentUser.organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.toSafeUser(user));
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeUser> {
    this.assertCanView(currentUser);
    const user = await prisma.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, currentUser: CurrentUser): Promise<SafeUser> {
    this.assertIsSuperAdmin(currentUser, 'modify users');

    const target = await prisma.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
    });
    if (!target) {
      throw new NotFoundException('User not found.');
    }

    const isSelf = target.id === currentUser.id;
    if (isSelf && dto.role !== undefined && dto.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot change your own role away from Super Admin.');
    }
    if (dto.role === UserRole.SUPER_ADMIN && target.role !== UserRole.SUPER_ADMIN) {
      // Same documented rule as create(): no path in this API promotes
      // anyone new to Super Admin.
      throw new BadRequestException('Promoting a user to Super Admin is not supported through this API.');
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
      },
    });
    return this.toSafeUser(updated);
  }

  /**
   * Self-service profile edit (PATCH /users/me). The target row is always
   * the caller's own — `currentUser.id` comes from the authenticated
   * session, never from the request body — so unlike `update()` there is no
   * cross-user authorization check to perform: name and department are the
   * only self-editable fields, and role/organizationId/email are untouched.
   */
  async updateMe(
    dto: UpdateMyProfileDto,
    currentUser: CurrentUser,
  ): Promise<SafeUser> {
    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
      },
    });
    return this.toSafeUser(updated);
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    currentUser: CurrentUser,
  ): Promise<SafeUser> {
    this.assertIsSuperAdmin(currentUser, 'change user status');

    const target = await prisma.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
    });
    if (!target) {
      throw new NotFoundException('User not found.');
    }

    if (target.id === currentUser.id && dto.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }

    // Reuse Better Auth's own admin-plugin `banned` flag — and the
    // session-creation hook already wired in src/auth/auth.ts that rejects
    // sign-in for banned users — instead of building custom session
    // revocation. Limitation (documented, not silently ignored): this
    // blocks new sign-ins; it does not invalidate a session already issued
    // before deactivation. ActiveUserGuard closes that gap for SevenCRM's
    // own API by re-checking status on every request.
    const banned = dto.status === UserStatus.INACTIVE;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        status: dto.status,
        banned,
        banReason: banned ? 'Deactivated by administrator' : null,
        banExpires: null,
      },
    });
    return this.toSafeUser(updated);
  }

  private assertIsSuperAdmin(currentUser: CurrentUser, action: string): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(`Only a Super Admin can ${action}.`);
    }
  }

  private assertCanView(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to view users.');
    }
  }

  private isDuplicateEmailError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('body' in error)) {
      return false;
    }
    const body = (error as { body?: unknown }).body;
    return (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      (body as { code?: string }).code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
    );
  }

  private toSafeUser(user: RawCrmUser): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role as UserRole,
      department: user.department,
      status: user.status as UserStatus,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
