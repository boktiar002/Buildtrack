import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { z } from 'zod';
import { NotificationChannel, ProjectStatus, RiskLevel, UpdateStatus } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Milestone } from '../projects/entities/milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { ProgressUpdate } from '../updates/entities/progress-update.entity';
import { AiService } from './ai.service';
import { computeRisk, RiskFactor } from './delay-risk';
import { DelayRiskScore } from './entities/delay-risk-score.entity';

const schema = z.object({ explanation: z.string().min(10).max(800), actions: z.array(z.string().max(200)).max(4).default([]) });

@Injectable()
export class DelayRiskService {
  private readonly logger = new Logger(DelayRiskService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ai: AiService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async compute(project: Project, now = new Date()) {
    const stages = await this.db.getRepository(Milestone).find({ where: { projectId: project.id }, order: { sortOrder: 'ASC' } });
    const last = await this.db.getRepository(ProgressUpdate).findOne({
      where: { projectId: project.id, status: UpdateStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });
    const risk = computeRisk(
      {
        startDate: project.startDate,
        originalHandoverDate: project.originalHandoverDate,
        expectedHandoverDate: project.expectedHandoverDate,
        stages,
        lastPublishedUpdate: last?.createdAt ?? null,
      },
      now,
    );

    const explained = await this.ai.json(
      { orgId: project.organizationId, feature: 'delay-risk' },
      {
        system:
          "You explain construction delay-risk scores to a real estate developer's manager in plain English. " +
          'Use only the factors given. Be specific and calm. Suggest up to three practical next steps for the manager. ' +
          'Do not invent causes that are not in the factors.',
        prompt:
          `Project: ${project.name}. Risk score ${risk.score}/100 (${risk.level}). Actual progress ${risk.actual}%` +
          (risk.expected !== null ? `, planned progress ${risk.expected}%` : '') +
          `.\nFactors:\n${risk.factors.map((f) => `- ${f.label} (+${f.points}): ${f.detail}`).join('\n') || '- none'}`,
        shape: '{"explanation": "2-3 sentences", "actions": ["short action"]}',
        schema,
        maxOutputTokens: 400,
      },
      () => templateExplanation(risk.level, risk.factors),
    );
    const text = `${explained.data.explanation}${explained.data.actions.length ? `\n\nSuggested actions:\n- ${explained.data.actions.join('\n- ')}` : ''}`;

    const previous = await this.latest(project.id);
    const saved = await this.db.getRepository(DelayRiskScore).save({
      projectId: project.id,
      milestoneId: null,
      score: risk.score,
      level: risk.level,
      factors: risk.factors,
      explanation: text,
    });

    if (risk.level === RiskLevel.HIGH && previous?.level !== RiskLevel.HIGH) {
      this.notifications.send({
        userIds: await this.notifications.staffIds(project.organizationId),
        type: 'RISK_HIGH',
        title: `High delay risk: ${project.name}`,
        body: explained.data.explanation,
        link: `/admin/projects/${project.id}?tab=risk`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    }
    return { ...saved, actual: risk.actual, expected: risk.expected, source: explained.source };
  }

  latest(projectId: string) {
    return this.db.getRepository(DelayRiskScore).findOne({ where: { projectId }, order: { computedAt: 'DESC' } });
  }

  async forProject(user: AuthUser, projectId: string) {
    await this.access.project(user, projectId);
    const history = await this.db.getRepository(DelayRiskScore).find({ where: { projectId }, order: { computedAt: 'DESC' }, take: 30 });
    return {
      latest: history[0] ?? null,
      history: history.reverse().map((h) => ({ score: h.score, level: h.level, computedAt: h.computedAt })),
    };
  }

  async recompute(user: AuthUser, projectId: string) {
    const project = await this.access.project(user, projectId);
    return this.compute(project);
  }

  /** Daily job: scores every active project; one failing project never stops the others. */
  async computeAll() {
    const projects = await this.db
      .getRepository(Project)
      .find({ where: { status: In([ProjectStatus.PLANNING, ProjectStatus.UNDER_CONSTRUCTION]) } });
    let ok = 0;
    for (const p of projects) {
      try {
        await this.compute(p);
        ok++;
      } catch (err) {
        this.logger.error({ err, projectId: p.id }, 'Risk computation failed');
      }
    }
    return { projects: projects.length, ok };
  }
}

export function templateExplanation(level: RiskLevel, factors: RiskFactor[]) {
  if (!factors.length) {
    return {
      explanation: 'The project is on track: progress matches the plan and updates are regular.',
      actions: ['Keep posting site updates every week.'],
    };
  }
  const top = [...factors].sort((a, b) => b.points - a.points);
  const actions: string[] = [];
  for (const f of top) {
    if (f.label === 'Behind schedule' || f.label === 'Pace forecast')
      actions.push('Review the work plan and resources for the current stage with the site engineer.');
    if (f.label === 'Current stage overdue') actions.push('Agree a realistic finish date for the current stage and record it.');
    if (f.label === 'No recent site updates') actions.push('Ask the site engineer to post a progress update with photos.');
    if (f.label === 'Handover already moved') actions.push('Keep buyers informed with a clear update on the new timeline.');
  }
  return {
    explanation: `Delay risk is ${level.toLowerCase()}. Main reasons: ${top
      .slice(0, 3)
      .map((f) => f.detail)
      .join(' ')}`,
    actions: [...new Set(actions)].slice(0, 3),
  };
}
