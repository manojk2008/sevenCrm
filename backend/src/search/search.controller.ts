import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

// Authentication is enforced by Better Auth's global AuthGuard; ActiveUserGuard
// additionally rejects a deactivated user's session, exactly as on every
// other completed module. Search is READ-ONLY — no @Post/@Patch/@Delete
// routes exist, and organizationId always comes from `session.user`, never
// from a route/query parameter (the global forbidNonWhitelisted
// ValidationPipe rejects any attempt to supply one).
@Controller('search')
@UseGuards(ActiveUserGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchQueryDto, @Session() session: AppSession) {
    return this.searchService.search(session.user, query);
  }
}
