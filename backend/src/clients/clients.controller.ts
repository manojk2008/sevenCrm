import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientStatusDto } from './dto/update-client-status.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
@Controller('clients')
@UseGuards(ActiveUserGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto, @Session() session: AppSession) {
    return this.clientsService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListClientsQueryDto, @Session() session: AppSession) {
    return this.clientsService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.clientsService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @Session() session: AppSession) {
    return this.clientsService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClientStatusDto,
    @Session() session: AppSession,
  ) {
    return this.clientsService.updateStatus(id, dto, session.user);
  }

  @Get(':id/contacts')
  listContacts(@Param('id') id: string, @Session() session: AppSession) {
    return this.clientsService.listContacts(id, session.user);
  }

  @Post(':id/contacts')
  createContact(
    @Param('id') id: string,
    @Body() dto: CreateClientContactDto,
    @Session() session: AppSession,
  ) {
    return this.clientsService.createContact(id, dto, session.user);
  }

  @Patch(':id/contacts/:contactId')
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateClientContactDto,
    @Session() session: AppSession,
  ) {
    return this.clientsService.updateContact(id, contactId, dto, session.user);
  }

  @Delete(':id/contacts/:contactId')
  deleteContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Session() session: AppSession,
  ) {
    return this.clientsService.deleteContact(id, contactId, session.user);
  }
}
