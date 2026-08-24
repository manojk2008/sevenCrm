import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { ProductGroupsService } from './product-groups.service';
import { CreateProductGroupDto } from './dto/create-product-group.dto';
import { UpdateProductGroupDto } from './dto/update-product-group.dto';
import { UpdateProductGroupStatusDto } from './dto/update-product-group-status.dto';
import { ListProductGroupsQueryDto } from './dto/list-product-groups-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// There is deliberately no DELETE route: like Clients/Enquiries, a product
// group is never hard-deleted; deactivation (status -> INACTIVE) is the
// lifecycle mechanism, and Product.productGroupId's RESTRICT FK means a
// group containing products couldn't be deleted anyway.
@Controller('product-groups')
@UseGuards(ActiveUserGuard)
export class ProductGroupsController {
  constructor(private readonly productGroupsService: ProductGroupsService) {}

  @Post()
  create(@Body() dto: CreateProductGroupDto, @Session() session: AppSession) {
    return this.productGroupsService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListProductGroupsQueryDto, @Session() session: AppSession) {
    return this.productGroupsService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.productGroupsService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductGroupDto, @Session() session: AppSession) {
    return this.productGroupsService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductGroupStatusDto,
    @Session() session: AppSession,
  ) {
    return this.productGroupsService.updateStatus(id, dto, session.user);
  }
}
