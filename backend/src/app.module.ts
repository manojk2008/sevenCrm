import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { auth } from './auth/auth';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ClientsModule } from './clients/clients.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { EnquirySourcesModule } from './enquiry-sources/enquiry-sources.module';
import { ProductGroupsModule } from './product-groups/product-groups.module';
import { ProductsModule } from './products/products.module';
import { QuotationsModule } from './quotations/quotations.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { TasksModule } from './tasks/tasks.module';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ActorContextMiddleware } from './audit-logs/actor-context.middleware';
import { TaxRatesModule } from './tax-rates/tax-rates.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    UsersModule,
    OrganizationsModule,
    ClientsModule,
    EnquiriesModule,
    EnquirySourcesModule,
    ProductGroupsModule,
    ProductsModule,
    QuotationsModule,
    FollowUpsModule,
    TasksModule,
    SalesModule,
    DashboardModule,
    AnalyticsModule,
    NotificationsModule,
    SearchModule,
    AuditLogsModule,
    TaxRatesModule,
    EmailTemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // See ActorContextMiddleware's own doc comment for why this is
    // middleware (not a guard) and why it is self-sufficient rather than
    // reading `request.session`.
    consumer.apply(ActorContextMiddleware).forRoutes('*');
  }
}
