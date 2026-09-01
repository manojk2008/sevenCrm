import { Module } from '@nestjs/common';
import { EnquirySourcesController } from './enquiry-sources.controller';
import { EnquirySourcesService } from './enquiry-sources.service';

@Module({
  controllers: [EnquirySourcesController],
  providers: [EnquirySourcesService],
})
export class EnquirySourcesModule {}
