import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// Deactivation (status -> INACTIVE) remains the normal lifecycle mechanism.
// DELETE below is a separate, SUPER_ADMIN/ADMIN-only permanent-removal
// action, blocked whenever the product is still referenced by an
// EnquiryProduct or QuotationLineItem row — see ProductsService.delete.
@Controller('products')
@UseGuards(ActiveUserGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto, @Session() session: AppSession) {
    return this.productsService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListProductsQueryDto, @Session() session: AppSession) {
    return this.productsService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.productsService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Session() session: AppSession) {
    return this.productsService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
    @Session() session: AppSession,
  ) {
    return this.productsService.updateStatus(id, dto, session.user);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Session() session: AppSession) {
    return this.productsService.delete(id, session.user);
  }
}
