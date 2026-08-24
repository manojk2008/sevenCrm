import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { auth } from './auth/auth';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { ProductGroupsModule } from './product-groups/product-groups.module';
import { ProductsModule } from './products/products.module';
import { QuotationsModule } from './quotations/quotations.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    UsersModule,
    ClientsModule,
    EnquiriesModule,
    ProductGroupsModule,
    ProductsModule,
    QuotationsModule,
    FollowUpsModule,
    SalesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
