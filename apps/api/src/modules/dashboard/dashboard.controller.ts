import { Controller, ForbiddenException, Get, Header, Post, Query, Res, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { loadEnv } from '../../config/env';
import { SchedulerService } from '../scheduler/scheduler.service';
import { DashboardService } from './dashboard.service';
import { ReportQueryDto } from './dto/report-query.dto';

function csv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '');
    // Protect against spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

@ApiTags('dashboard')
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly scheduler: SchedulerService,
  ) {}

  @ApiOperation({ summary: 'Staff dashboard: money, progress, overdue, AI performance' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('dashboard/admin')
  admin(@CurrentUser() u: AuthUser) {
    return this.dashboard.admin(u);
  }

  @ApiOperation({ summary: 'Buyer dashboard summary' })
  @Roles(Role.BUYER)
  @Get('dashboard/buyer')
  buyer(@CurrentUser() u: AuthUser) {
    return this.dashboard.buyer(u);
  }

  @ApiOperation({ summary: 'Collections report (JSON or CSV)' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('reports/collections')
  async collections(@CurrentUser() u: AuthUser, @Query() q: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, 'collections', await this.dashboard.collections(u, q), q.format);
  }

  @ApiOperation({ summary: 'Installments due and overdue (JSON or CSV)' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('reports/dues')
  async dues(@CurrentUser() u: AuthUser, @Query() q: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, 'dues', await this.dashboard.dues(u, q), q.format);
  }

  @ApiOperation({ summary: 'Construction progress report (JSON or CSV)' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('reports/progress')
  async progress(@CurrentUser() u: AuthUser, @Query() q: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, 'progress', await this.dashboard.progressReport(u, q), q.format);
  }

  @ApiOperation({ summary: 'Delay risk of every project' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('reports/risk')
  risk(@CurrentUser() u: AuthUser) {
    return this.dashboard.riskOverview(u);
  }

  @ApiOperation({ summary: 'Recent assistant questions and answers' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('reports/assistant')
  assistant(@CurrentUser() u: AuthUser) {
    return this.dashboard.assistantLog(u);
  }

  /** Development helper for the demo: runs the daily job now. Disabled in production. */
  @ApiOperation({ summary: 'Run the daily job now (development only)' })
  @Roles(Role.ORG_ADMIN)
  @Post('dev/run-scheduler')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  runScheduler() {
    if (loadEnv().NODE_ENV === 'production') throw new ForbiddenException('Not available in production.');
    return this.scheduler.runAll();
  }

  private respond(res: Response, name: string, rows: Array<Record<string, unknown>>, format?: string) {
    if (format !== 'csv') return rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return csv(rows);
  }
}
