import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from './guards/active-user.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
@Controller('users')
@UseGuards(ActiveUserGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto, @Session() session: AppSession) {
    return this.usersService.create(dto, session.user);
  }

  @Get()
  findAll(@Session() session: AppSession) {
    return this.usersService.findAllForOrg(session.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.usersService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Session() session: AppSession) {
    return this.usersService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Session() session: AppSession,
  ) {
    return this.usersService.updateStatus(id, dto, session.user);
  }
}
