/* eslint-disable no-console */
import 'reflect-metadata';
import { config } from '../dotenv';
config();
process.env.BT_SILENT_NOTIFICATIONS = '1';
process.env.SCHEDULER_ENABLED = 'false';
process.env.LOG_LEVEL = process.env.LOG_LEVEL === 'debug' ? 'debug' : 'warn';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  AiDraftDecision,
  DocumentType,
  DocumentVisibility,
  InstallmentDueType,
  PaymentMethod,
  ProjectStatus,
  Role,
  TicketStatus,
  UpdateStatus,
} from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { addDays } from '../../common/utils/dates';
import { fromPoisha, toPoisha } from '../../common/utils/money';
import { DelayRiskService } from '../../modules/ai/delay-risk.service';
import { DocumentIndexerService } from '../../modules/ai/document-indexer.service';
import { AiPhotoAnalysis } from '../../modules/ai/entities/ai-photo-analysis.entity';
import { AiUpdateDraft } from '../../modules/ai/entities/ai-update-draft.entity';
import { hashPassword } from '../../modules/auth/auth.service';
import { DocumentEntity } from '../../modules/documents/entities/document.entity';
import { Installment } from '../../modules/finance/entities/installment.entity';
import { Unit } from '../../modules/finance/entities/unit.entity';
import { FinanceService, PlanItem } from '../../modules/finance/finance.service';
import { Milestone } from '../../modules/projects/entities/milestone.entity';
import { ProjectAssignment } from '../../modules/projects/entities/project-assignment.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { MilestonesService } from '../../modules/projects/milestones.service';
import { ProjectsService } from '../../modules/projects/projects.service';
import { SchedulerService } from '../../modules/scheduler/scheduler.service';
import { StorageService } from '../../modules/storage/storage.service';
import { TicketMessage } from '../../modules/tickets/entities/ticket-message.entity';
import { Ticket } from '../../modules/tickets/entities/ticket.entity';
import { ProgressPhoto } from '../../modules/updates/entities/progress-photo.entity';
import { ProgressUpdate } from '../../modules/updates/entities/progress-update.entity';
import { Organization } from '../../modules/users/entities/organization.entity';
import { User } from '../../modules/users/entities/user.entity';
import { placeholderPhoto, simplePdf } from './assets';

const PASSWORD = 'Demo@12345';
const DAY = 86_400_000;
const now = new Date();
const monthsAgo = (m: number) => new Date(now.getTime() - m * 30.4 * DAY);
const monthsAhead = (m: number) => new Date(now.getTime() + m * 30.4 * DAY);

// Deterministic pseudo-random numbers so every seed run gives the same demo.
let seedState = 42;
const rand = () => (seedState = (seedState * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The demo seed must not run in production.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get(DataSource);

  if (await db.getRepository(Organization).exist({ where: { slug: 'pipra' } })) {
    console.log('Demo data already exists. Run "pnpm db:reset" to start again.');
    await app.close();
    return;
  }

  const projects = app.get(ProjectsService);
  const milestones = app.get(MilestonesService);
  const finance = app.get(FinanceService);
  const storage = app.get(StorageService);
  const indexer = app.get(DocumentIndexerService);
  const risk = app.get(DelayRiskService);
  const scheduler = app.get(SchedulerService);

  console.log('Creating organization and staff...');
  const org = await db.getRepository(Organization).save({
    name: 'Pipra Estate',
    slug: 'pipra',
    receiptPrefix: 'PIP',
    milestoneGraceDays: 15,
    primaryColor: '#2D3A42',
    accentColor: '#A68B55',
  });
  const hash = await hashPassword(PASSWORD);
  const mkUser = (role: Role, name: string, email: string, phone: string) =>
    db.getRepository(User).save({ organizationId: org.id, role, name, email, phone, passwordHash: hash });
  const admin = await mkUser(Role.ORG_ADMIN, 'Ayesha Rahman', 'admin@pipra.test', '+8801711000001');
  const manager = await mkUser(Role.MANAGER, 'Tanvir Hossain', 'manager@pipra.test', '+8801711000002');
  const engineer = await mkUser(Role.ENGINEER, 'Rafiq Islam', 'engineer@pipra.test', '+8801711000003');
  // Day-to-day work (bookings, payments, handover changes) is done by the manager, as in real life.
  const actor: AuthUser = { id: manager.id, orgId: org.id, role: Role.MANAGER, name: manager.name, email: manager.email };

  const buyerNames = [
    'Nusrat Jahan',
    'Kamal Uddin',
    'Farhana Akter',
    'Shahidul Alam',
    'Mitu Chowdhury',
    'Imran Kabir',
    'Sabrina Sultana',
    'Arif Mahmud',
    'Rumana Haque',
    'Tareq Aziz',
    'Lamia Ferdous',
    'Habibur Rahman',
  ];
  const buyers: User[] = [];
  for (let i = 0; i < buyerNames.length; i++) {
    buyers.push(await mkUser(Role.BUYER, buyerNames[i], `buyer${i + 1}@pipra.test`, `+88017120000${String(i + 10).padStart(2, '0')}`));
  }

  console.log('Creating projects and construction stages...');
  const heights = await projects.create(actor, {
    name: 'Pipra Heights',
    location: 'Block D, Bashundhara R/A, Dhaka',
    description: 'A 10-storey residential building with 40 family apartments, rooftop garden, two lifts and full generator backup.',
    totalFloors: 10,
    startDate: monthsAgo(14).toISOString(),
    originalHandoverDate: monthsAhead(22).toISOString(),
    isPublic: true,
  });
  await db.getRepository(Project).update(heights.id, { status: ProjectStatus.UNDER_CONSTRUCTION });
  const garden = await projects.create(actor, {
    name: 'Pipra Garden',
    location: 'Sector 13, Uttara, Dhaka',
    description: 'An 8-storey green residence with 24 apartments around a landscaped courtyard. Bookings open soon.',
    totalFloors: 8,
    startDate: monthsAhead(3).toISOString(),
    originalHandoverDate: monthsAhead(39).toISOString(),
    isPublic: true,
  });
  await db.getRepository(ProjectAssignment).insert([
    { projectId: heights.id, userId: engineer.id },
    { projectId: garden.id, userId: engineer.id },
  ]);

  for (const [p, hue, floors] of [
    [heights, 205, 4],
    [garden, 140, 0],
  ] as const) {
    const cover = await placeholderPhoto({
      title: p.name,
      subtitle: p.location.split(',').slice(-2).join(',').trim(),
      floorsDone: floors,
      totalFloors: p.totalFloors,
      hue,
    });
    const key = `photos/cover-${p.slug}.jpg`;
    await storage.put(key, cover);
    await db.getRepository(Project).update(p.id, { coverImageKey: key });
  }

  console.log('Creating 40 flats...');
  const units = [];
  for (let floor = 1; floor <= 10; floor++) {
    for (const [i, side] of ['A', 'B', 'C', 'D'].entries()) {
      const size = [1450, 1250, 1250, 1650][i];
      const rate = 7200 + floor * 60; // Tk per sqft, higher floors cost a little more
      units.push({
        code: `${side}-${floor}`,
        floor,
        sizeSqft: size,
        bedrooms: size > 1400 ? 4 : 3,
        listPrice: fromPoisha(Math.round((size * rate) / 1000) * 1000 * 100),
      });
    }
  }
  await finance.createUnits(actor, heights.id, units);
  const unitRows = await db.getRepository(Unit).find({ where: { projectId: heights.id } });
  const unitBy = new Map(unitRows.map((u) => [u.code, u]));
  const stages = await db.getRepository(Milestone).find({ where: { projectId: heights.id }, order: { sortOrder: 'ASC' } });
  const stage = (name: string) => stages.find((s) => s.name === name)!;

  // ---------------------------------------------------------- replay history
  const completions = stages.slice(0, 7).map((s, i) => ({
    at: new Date(s.plannedEnd!.getTime() + (i < 3 ? 5 : 12 + i * 4) * DAY), // a little late, and slipping
    milestone: s,
  }));
  const soldCodes = ['A-3', 'B-5', 'C-2', 'D-7', 'A-6', 'B-8', 'C-9', 'D-4', 'A-9', 'B-2', 'C-6', 'D-10'];
  const bookings = soldCodes.map((code, i) => ({ at: monthsAgo(13 - i), code, buyer: buyers[i] }));

  const linkedStages = ['Foundation', 'Floor 2 slab', 'Floor 4 slab', 'Floor 6 slab', 'Floor 8 slab', 'Roof slab', 'Brick work', 'Plaster'];
  const events = [
    ...completions.map((c) => ({
      at: c.at,
      run: () => milestones.setProgress(actor, c.milestone.id, { progress: 100, completedAt: c.at }),
    })),
    ...bookings.map((b) => ({
      at: b.at,
      run: async () => {
        const unit = unitBy.get(b.code)!;
        const total = toPoisha(unit.listPrice);
        const thousand = (p: number) => Math.round(p / 100000) * 100000;
        const booking = thousand(total * 0.1);
        const agreement = thousand(total * 0.15);
        const finalPart = thousand(total * 0.1);
        const each = Math.floor((total - booking - agreement - finalPart) / linkedStages.length / 100000) * 100000; // whole thousands of Taka
        const plan: PlanItem[] = [
          {
            label: 'Booking money (10%)',
            amount: fromPoisha(booking),
            dueType: InstallmentDueType.FIXED_DATE,
            dueDate: b.at.toISOString(),
          },
          {
            label: 'Agreement signing (15%)',
            amount: fromPoisha(agreement),
            dueType: InstallmentDueType.FIXED_DATE,
            dueDate: addDays(b.at, 30).toISOString(),
          },
          ...linkedStages.map((name) => ({
            label: `On completion of ${name}`,
            amount: fromPoisha(each),
            dueType: InstallmentDueType.MILESTONE,
            milestoneId: stage(name).id,
          })),
        ];
        const used = plan.reduce((s, p) => s + toPoisha(p.amount), 0);
        plan.push({
          label: 'Final payment at handover (10%)',
          amount: fromPoisha(total - used),
          dueType: InstallmentDueType.MILESTONE,
          milestoneId: stages[stages.length - 1].id,
        });
        await finance.createPurchase(actor, {
          unitId: unit.id,
          buyerId: b.buyer.id,
          bookingDate: b.at.toISOString(),
          totalPrice: unit.listPrice,
          installments: plan,
        });
      },
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  console.log('Replaying 14 months of bookings and construction...');
  for (const e of events) await e.run();
  await milestones.setProgress(actor, stages[7].id, { progress: 60 }); // current stage: Floor 5 slab

  console.log('Recording payments...');
  const late = new Set([buyers[2].id, buyers[6].id]); // these two have an overdue installment
  const partial = buyers[4].id; // this one paid half of the latest installment
  const due = await db
    .getRepository(Installment)
    .createQueryBuilder('i')
    .innerJoinAndSelect('i.purchase', 'p')
    .where('i.dueDate IS NOT NULL AND i.dueDate <= :now', { now: addDays(now, 20) })
    .orderBy('i.dueDate', 'ASC')
    .getMany();
  const latestDue = new Map<string, string>();
  for (const i of due) if (i.dueDate! <= now) latestDue.set(i.purchase.buyerId, i.id);
  const payments: Array<{ purchaseId: string; amount: string; paidAt: Date; method: PaymentMethod }> = [];
  const methods = [
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.BKASH,
    PaymentMethod.CHEQUE,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.NAGAD,
  ];
  for (const i of due) {
    const buyerId = i.purchase.buyerId;
    const isLatest = latestDue.get(buyerId) === i.id;
    if (i.dueDate! > now) continue; // not due yet
    if (late.has(buyerId) && isLatest) continue;
    let amount = i.amount;
    if (buyerId === partial && isLatest) amount = fromPoisha(Math.round(toPoisha(i.amount) / 2));
    const paidAt = new Date(
      Math.min(now.getTime() - DAY, Math.max(i.purchase.bookingDate.getTime(), i.dueDate!.getTime() - Math.floor(rand() * 10) * DAY)),
    );
    payments.push({ purchaseId: i.purchaseId, amount, paidAt, method: methods[Math.floor(rand() * methods.length)] });
  }
  payments.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  for (const p of payments) {
    await finance.recordPayment(actor, p.purchaseId, {
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      reference: p.method === PaymentMethod.CHEQUE ? `CHQ-${Math.floor(100000 + rand() * 899999)}` : `TRX${Math.floor(1e8 + rand() * 9e8)}`,
    });
  }
  // Make the two "late" installments clearly overdue for the demo.
  for (const buyerId of late) {
    const id = latestDue.get(buyerId);
    if (id) {
      const inst = await db.getRepository(Installment).findOneByOrFail({ id });
      if (inst.dueDate! > addDays(now, -10)) await db.getRepository(Installment).update(id, { dueDate: addDays(now, -12) });
    }
  }

  console.log('Changing the handover date once (with a reason)...');
  await projects.changeHandover(
    actor,
    heights.id,
    addDays((await db.getRepository(Project).findOneByOrFail({ id: heights.id })).expectedHandoverDate, 91).toISOString(),
    'Monsoon delay in piling work and steel price adjustment.',
  );

  console.log('Creating progress updates with photos...');
  const updateStages = [...stages.slice(0, 8)];
  let photoCount = 0;
  let k = 0;
  for (const [idx, s] of updateStages.entries()) {
    const perStage = idx < 7 ? 2 : 1;
    for (let j = 0; j < perStage; j++) {
      k++;
      const comp = completions[idx]?.at ?? now;
      const created = idx < 7 ? new Date(comp.getTime() - (perStage - 1 - j) * 20 * DAY) : addDays(now, -6);
      const progressAfter = idx < 7 ? (j === perStage - 1 ? 100 : 55) : 60;
      const floorsDone = Math.max(0, idx - 2) + (progressAfter === 100 ? 1 : 0);
      const title = progressAfter === 100 ? `${s.name} completed` : `${s.name} in progress`;
      const text =
        progressAfter === 100
          ? `We are pleased to share that ${s.name.toLowerCase()} at Pipra Heights is now complete. The site team finished the work after quality checks, and the next stage has started. Thank you for your patience and trust.`
          : `Work on ${s.name.toLowerCase()} is moving ahead and is about ${progressAfter}% complete. Reinforcement and shuttering are in place and concrete work is progressing as planned. We will share more photos soon.`;
      const upd = await db.getRepository(ProgressUpdate).save({
        projectId: heights.id,
        milestoneId: s.id,
        authorId: engineer.id,
        title,
        engineerNote: `${s.name}: ${progressAfter}% done.${progressAfter === 100 ? ' Casting finished, curing started.' : ' Rod binding done on most of the area.'}`,
        publishedText: text,
        progressAfter,
        status: UpdateStatus.PUBLISHED,
        approvedById: admin.id,
        approvedAt: created,
        createdAt: created,
      });
      const nPhotos = 1 + (k % 3);
      for (let ph = 0; ph < nPhotos; ph++) {
        const img = await placeholderPhoto({
          title: `Pipra Heights · ${s.name}`,
          subtitle: created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          floorsDone,
          totalFloors: 10,
          hue: 190 + ph * 12 + idx * 4,
        });
        const { fileKey, thumbKey } = await storage.savePhoto(img);
        const photo = await db.getRepository(ProgressPhoto).save({ updateId: upd.id, fileKey, thumbKey, sortOrder: ph });
        const correct = (k + ph) % 7 !== 0; // most AI suggestions were accepted, a few corrected
        await db.getRepository(AiPhotoAnalysis).save({
          photoId: photo.id,
          suggestedMilestoneId: correct ? s.id : stages[Math.min(stages.length - 1, idx + 1)].id,
          suggestedProgress: progressAfter,
          confidence: correct ? 0.82 : 0.58,
          qualityWarnings: ph === 2 ? ['Too dark'] : [],
          description: `Concrete and reinforcement work visible on ${s.name.toLowerCase()}.`,
          model: 'demo-seed',
          accepted: correct,
          correctedMilestoneId: correct ? null : s.id,
          correctedProgress: correct ? null : progressAfter,
        });
        photoCount++;
      }
      await db.getRepository(AiUpdateDraft).save({
        updateId: upd.id,
        generated: `${title}\n\n${text}`,
        model: 'demo-seed',
        decision: k % 4 === 0 ? AiDraftDecision.EDITED : AiDraftDecision.APPROVED,
        reviewerId: admin.id,
        reviewedAt: created,
      });
    }
  }

  // One update waiting for the manager, to demonstrate the AI review step.
  const pending = await db.getRepository(ProgressUpdate).save({
    projectId: heights.id,
    milestoneId: stages[7].id,
    authorId: engineer.id,
    title: 'Floor 5 slab shuttering',
    engineerNote: 'Shuttering for floor 5 is complete on the north side. Rod binding 70% done. Rain stopped work for 2 days last week.',
    progressAfter: 70,
    status: UpdateStatus.PENDING_REVIEW,
  });
  const pImg = await placeholderPhoto({
    title: 'Pipra Heights · Floor 5 slab',
    subtitle: 'This week',
    floorsDone: 4,
    totalFloors: 10,
    hue: 210,
  });
  const pSaved = await storage.savePhoto(pImg);
  const pPhoto = await db.getRepository(ProgressPhoto).save({ updateId: pending.id, fileKey: pSaved.fileKey, thumbKey: pSaved.thumbKey });
  await db.getRepository(AiPhotoAnalysis).save({
    photoId: pPhoto.id,
    suggestedMilestoneId: stages[7].id,
    suggestedProgress: 70,
    confidence: 0.77,
    qualityWarnings: [],
    description: 'Shuttering and reinforcement for a floor slab, partly complete.',
    model: 'demo-seed',
    accepted: true,
  });
  await db.getRepository(AiUpdateDraft).save({
    updateId: pending.id,
    model: 'demo-seed',
    decision: AiDraftDecision.PENDING,
    generated:
      'Floor 5 slab: shuttering complete on the north side\n\nWork on the Floor 5 slab at Pipra Heights is moving ahead. Shuttering is complete on the north side and about 70% of the steel rod binding is done. Heavy rain stopped work for two days last week, but the team is back on schedule. Overall, the building is about 32% complete. See the new site photo below.',
  });

  console.log('Creating documents for the AI assistant...');
  const docs: Array<{ title: string; type: DocumentType; visibility: DocumentVisibility; purchaseId?: string; body: string[] }> = [
    {
      title: 'Pipra Heights buyer handbook',
      type: DocumentType.OTHER,
      visibility: DocumentVisibility.PROJECT_BUYERS,
      body: [
        'Car parking: every apartment at Pipra Heights includes one covered car parking space in the basement. A second space can be bought for Tk 8,00,000, subject to availability.',
        'Service charge: after handover, the monthly service charge is Tk 6 per square foot. It covers security, cleaning, lift and generator maintenance, and common area electricity.',
        'Generator backup: a 250 kVA generator supplies the lifts, water pumps, common areas and up to 4 lights and 3 fans in every apartment during power cuts.',
        'Lifts: two passenger lifts with a capacity of 8 people each, plus one stretcher-size service lift.',
        'Rooftop: a landscaped rooftop garden with a community hall is available to all residents.',
        'Changes to layout: buyers may request minor internal changes (tiles, kitchen fittings) until the brick work stage begins. Structural changes are not allowed.',
        'Late payment: if an installment is more than 30 days overdue, a delay charge of 1% per month on the overdue amount may apply as described in the sale agreement.',
        "Registration: the deed of the flat and its share of land is registered in the buyer's name after the full price is paid. Registration costs and government fees are paid by the buyer.",
        'Handover: the flat is handed over after full payment, completion of finishing work and the joint inspection with the buyer.',
      ],
    },
    {
      title: 'RAJUK approval summary (internal)',
      type: DocumentType.APPROVAL,
      visibility: DocumentVisibility.INTERNAL,
      body: ['Internal record of building plan approval. Approval number and conditions are kept in the head office file.'],
    },
  ];
  const firstPurchase = (await finance.myPurchases({ ...actor, id: buyers[0].id, role: Role.BUYER }))[0];
  docs.push({
    title: `Allotment letter - flat ${firstPurchase.unit.code}`,
    type: DocumentType.ALLOTMENT_LETTER,
    visibility: DocumentVisibility.PURCHASE_BUYER,
    purchaseId: firstPurchase.id,
    body: [
      `This letter confirms that flat ${firstPurchase.unit.code} at Pipra Heights, Block D, Bashundhara R/A, Dhaka, has been allotted to ${buyers[0].name}.`,
      `Flat size: ${firstPurchase.unit.sizeSqft} square feet, with one car parking space.`,
      'The total price and the installment schedule are described in the sale agreement. Payments are made to Pipra Estate by bank transfer, cheque, bKash or Nagad.',
    ],
  });
  for (const d of docs) {
    const pdf = await simplePdf(d.title, d.body);
    const { fileKey, mime } = await storage.saveDocument(pdf);
    const doc = await db.getRepository(DocumentEntity).save({
      organizationId: org.id,
      projectId: heights.id,
      purchaseId: d.purchaseId ?? null,
      title: d.title,
      type: d.type,
      visibility: d.visibility,
      fileKey,
      mimeType: mime,
      sizeBytes: pdf.length,
      uploadedById: admin.id,
    });
    await indexer.index(doc.id);
  }

  console.log('Creating support tickets...');
  const purchaseOf = async (b: User) => (await finance.myPurchases({ ...actor, id: b.id, role: Role.BUYER }))[0];
  const tickets: Array<[User, string, string, string | null, TicketStatus]> = [
    [
      buyers[1],
      'Can I choose the kitchen tiles?',
      'I would like to choose a different tile colour for my kitchen. Is that possible?',
      'Yes. Tile changes are possible until brick work starts. Please visit our office to see the samples.',
      TicketStatus.ANSWERED,
    ],
    [
      buyers[3],
      'Receipt for my agreement payment',
      'I paid the agreement installment by cheque. Can you confirm it was received?',
      'Your cheque has cleared and the receipt is now visible in your BuildTrack portal.',
      TicketStatus.CLOSED,
    ],
    [
      buyers[6],
      'Delay in my installment',
      'I will pay my overdue installment next week. Please do not add a delay charge.',
      null,
      TicketStatus.OPEN,
    ],
  ];
  for (const [b, subject, body, reply, status] of tickets) {
    const p = await purchaseOf(b);
    const t = await db.getRepository(Ticket).save({ purchaseId: p.id, subject, status });
    await db.getRepository(TicketMessage).save({ ticketId: t.id, authorId: b.id, body });
    if (reply) await db.getRepository(TicketMessage).save({ ticketId: t.id, authorId: admin.id, body: reply });
  }

  // The history above was replayed today by this script (on this machine, hence 127.0.0.1); give its audit entries the dates the events happened.
  await db.query(
    `UPDATE audit_logs a SET "createdAt" = p."paidAt" FROM payments p WHERE a.entity = 'Payment' AND a."entityId" = p.id::text`,
  );
  await db.query(
    `UPDATE audit_logs a SET "createdAt" = p."bookingDate" FROM purchases p WHERE a.entity = 'Purchase' AND a."entityId" = p.id::text`,
  );
  await db.query(`UPDATE audit_logs SET "ipAddress" = '127.0.0.1' WHERE "ipAddress" IS NULL`);

  console.log('Updating installment statuses and computing delay risk...');
  await scheduler.updateInstallments();
  await risk.computeAll();

  await app.close();
  console.log(`\nDemo data ready: 2 projects, 40 flats, ${buyers.length} buyers, ${payments.length} payments, ${photoCount + 1} photos.`);
  console.log(`Sign in with any of these (password ${PASSWORD}):`);
  console.log('  admin@pipra.test   manager@pipra.test   engineer@pipra.test   buyer1@pipra.test ... buyer12@pipra.test\n');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
