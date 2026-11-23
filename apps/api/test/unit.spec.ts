import { InstallmentDueType, InstallmentStatus, MilestoneStatus, RiskLevel } from '../src/common/enums';
import { formatTaka, fromPoisha, toPoisha } from '../src/common/utils/money';
import { withRetry } from '../src/common/utils/retry';
import { ruleBasedAnswer } from '../src/modules/ai/assistant.service';
import { computeRisk } from '../src/modules/ai/delay-risk';
import { chunkText } from '../src/modules/ai/document-indexer.service';
import { localEmbed } from '../src/modules/ai/providers/local-embedder';
import { templateUpdate } from '../src/modules/ai/update-writer.service';
import { cosine } from '../src/modules/ai/vector-store.service';
import { autoAllocate, computeStatus, validateManual } from '../src/modules/finance/installment-rules';
import { currentStage, overallProgress, stageTemplate, statusForProgress } from '../src/modules/projects/progress';

const DAY = 86_400_000;

describe('money', () => {
  it('converts without floating point errors', () => {
    expect(toPoisha('0.10') + toPoisha('0.20')).toBe(30);
    expect(fromPoisha(toPoisha('1250000.5'))).toBe('1250000.50');
    expect(toPoisha(1250000)).toBe(125000000);
    expect(() => toPoisha('12abc')).toThrow();
  });
  it('formats Taka with lakh grouping', () => {
    expect(formatTaka('1250000')).toBe('Tk 12,50,000');
    expect(formatTaka('999')).toBe('Tk 999');
    expect(formatTaka('10000000.5')).toBe('Tk 1,00,00,000.50');
  });
});

describe('progress rules', () => {
  it('stage template always totals 100', () => {
    for (const floors of [1, 3, 8, 10, 15, 30, 31, 45]) {
      const s = stageTemplate(floors);
      expect(s.reduce((a, m) => a + m.weight, 0)).toBe(100);
      expect(s.every((m) => m.weight >= 1)).toBe(true);
    }
  });
  it('spreads planned dates from start to handover', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2028-01-01');
    const s = stageTemplate(10, start, end);
    expect(s[0].plannedStart?.toISOString()).toBe(start.toISOString());
    expect(s[s.length - 1].plannedEnd?.toISOString()).toBe(end.toISOString());
  });
  it('computes weighted overall progress (R2)', () => {
    expect(
      overallProgress([
        { weight: 50, progress: 100 },
        { weight: 50, progress: 0 },
      ]),
    ).toBe(50);
    expect(
      overallProgress([
        { weight: 30, progress: 100 },
        { weight: 70, progress: 50 },
      ]),
    ).toBe(65);
    expect(overallProgress([])).toBe(0);
  });
  it('sets status from progress (R1)', () => {
    expect(statusForProgress(0)).toBe(MilestoneStatus.NOT_STARTED);
    expect(statusForProgress(40)).toBe(MilestoneStatus.IN_PROGRESS);
    expect(statusForProgress(100)).toBe(MilestoneStatus.COMPLETED);
  });
  it('finds the current stage', () => {
    const s = [
      { sortOrder: 2, status: MilestoneStatus.IN_PROGRESS },
      { sortOrder: 1, status: MilestoneStatus.COMPLETED },
    ];
    expect(currentStage(s)?.sortOrder).toBe(2);
  });
});

describe('installment rules', () => {
  const base = { amount: '100.00', paidAmount: '0.00', dueType: InstallmentDueType.FIXED_DATE, status: InstallmentStatus.UPCOMING };
  const now = new Date('2026-06-15T06:00:00Z');
  it('statuses follow R14, R19, R20', () => {
    expect(computeStatus({ ...base, dueDate: new Date(now.getTime() + 60 * DAY) }, now)).toBe(InstallmentStatus.UPCOMING);
    expect(computeStatus({ ...base, dueDate: new Date(now.getTime() + 10 * DAY) }, now)).toBe(InstallmentStatus.DUE);
    expect(computeStatus({ ...base, dueDate: new Date(now.getTime() - 2 * DAY) }, now)).toBe(InstallmentStatus.OVERDUE);
    expect(computeStatus({ ...base, paidAmount: '40.00', dueDate: new Date(now.getTime() + 5 * DAY) }, now)).toBe(
      InstallmentStatus.PARTIALLY_PAID,
    );
    expect(computeStatus({ ...base, paidAmount: '40.00', dueDate: new Date(now.getTime() - 5 * DAY) }, now)).toBe(
      InstallmentStatus.OVERDUE,
    );
    expect(computeStatus({ ...base, paidAmount: '100.00', dueDate: new Date(now.getTime() - 5 * DAY) }, now)).toBe(InstallmentStatus.PAID);
    expect(computeStatus({ ...base, dueType: InstallmentDueType.MILESTONE, dueDate: null }, now)).toBe(InstallmentStatus.UPCOMING);
    expect(computeStatus({ ...base, status: InstallmentStatus.WAIVED, dueDate: null }, now)).toBe(InstallmentStatus.WAIVED);
  });
  const plan = [
    {
      id: 'a',
      sortOrder: 1,
      amount: '100.00',
      paidAmount: '100.00',
      dueType: InstallmentDueType.FIXED_DATE,
      dueDate: null,
      status: InstallmentStatus.PAID,
    },
    {
      id: 'b',
      sortOrder: 2,
      amount: '100.00',
      paidAmount: '30.00',
      dueType: InstallmentDueType.FIXED_DATE,
      dueDate: null,
      status: InstallmentStatus.PARTIALLY_PAID,
    },
    {
      id: 'c',
      sortOrder: 3,
      amount: '100.00',
      paidAmount: '0.00',
      dueType: InstallmentDueType.FIXED_DATE,
      dueDate: null,
      status: InstallmentStatus.UPCOMING,
    },
  ];
  it('allocates oldest first (R13)', () => {
    const a = autoAllocate(plan, toPoisha('120'));
    expect(a.get('a')).toBeUndefined();
    expect(a.get('b')).toBe(7000);
    expect(a.get('c')).toBe(5000);
  });
  it('rejects overpayment and bad manual allocations', () => {
    expect(() => autoAllocate(plan, toPoisha('171'))).toThrow('more than the remaining balance');
    expect(() => validateManual(plan, [{ installmentId: 'c', amount: 5000 }], 6000)).toThrow('add up');
    expect(() => validateManual(plan, [{ installmentId: 'b', amount: 8000 }], 8000)).toThrow('overpaid');
    expect(validateManual(plan, [{ installmentId: 'c', amount: 5000 }], 5000).get('c')).toBe(5000);
  });
});

describe('AI helpers', () => {
  it('chunks long text with overlap', () => {
    const text = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} about the building.`).join(' ');
    const chunks = chunkText(text, 400, 80);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 400)).toBe(true);
  });
  it('local embeddings rank related text higher', () => {
    const q = localEmbed('Is car parking included with my flat?');
    const parking = localEmbed('Car parking: every apartment includes one covered car parking space.');
    const lift = localEmbed('Lifts: two passenger lifts with a capacity of 8 people each.');
    expect(cosine(q, parking)).toBeGreaterThan(cosine(q, lift));
  });
  it('fallback assistant answers from records and admits when unsure', () => {
    const facts = [
      { id: 'F3', label: 'Next payment', text: 'Your next payment is Tk 5,00,000, due on 10 Dec 2026.' },
      { id: 'F4', label: 'Payment totals', text: 'You have paid Tk 20,00,000.' },
      { id: 'F8', label: 'Handover date', text: 'The expected handover date is 01 Jan 2029.' },
      {
        id: 'D1',
        label: 'Document: Buyer handbook',
        text: 'Lifts: two passenger lifts. Car parking: every apartment includes one covered car parking space.',
      },
    ];
    const pay = ruleBasedAnswer('When is my next payment?', facts);
    expect(pay.sources).toEqual(['F3']);
    expect(pay.unsure).toBe(false);
    expect(ruleBasedAnswer('How much have I paid so far?', facts).sources).toEqual(['F4']);
    expect(ruleBasedAnswer('When will I get the keys?', facts).sources).toEqual(['F8']);
    const parking = ruleBasedAnswer('Is car parking included with my flat?', facts);
    expect(parking.sources).toEqual(['D1']);
    expect(parking.answer).toContain('covered car parking space');
    expect(parking.answer).not.toContain('Lifts');
    expect(ruleBasedAnswer('What is the colour of the sky?', facts).unsure).toBe(true);
  });
  it('template update never invents facts', () => {
    const t = templateUpdate({
      projectName: 'Pipra Heights',
      stageName: 'Floor 6 slab',
      progressBefore: 60,
      progressAfter: 100,
      overallProgress: 41.2,
      engineerTitle: 'Done',
      engineerNote: null,
      photoDescription: null,
      photoCount: 2,
    });
    expect(t.title).toBe('Floor 6 slab completed');
    expect(t.text).toContain('41.2%');
  });
  it('delay risk is low on schedule and high when far behind', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2027-01-01');
    const stages = stageTemplate(4, start, end).map((s, i) => ({ ...s, id: String(i), progress: 0, status: MilestoneStatus.NOT_STARTED }));
    const now = new Date('2026-01-01');
    const onTrack = stages.map((s) => (s.plannedEnd! <= now ? { ...s, progress: 100, status: MilestoneStatus.COMPLETED } : s));
    const low = computeRisk(
      {
        startDate: start,
        originalHandoverDate: end,
        expectedHandoverDate: end,
        stages: onTrack,
        lastPublishedUpdate: new Date('2025-12-25'),
      },
      now,
    );
    expect(low.level).toBe(RiskLevel.LOW);
    const behind = stages.map((s, i) => (i < 2 ? { ...s, progress: 100, status: MilestoneStatus.COMPLETED } : s));
    const high = computeRisk(
      {
        startDate: start,
        originalHandoverDate: end,
        expectedHandoverDate: new Date('2027-06-01'),
        stages: behind,
        lastPublishedUpdate: new Date('2025-09-01'),
      },
      now,
    );
    expect(high.level).toBe(RiskLevel.HIGH);
    expect(high.factors.map((f) => f.label)).toEqual(
      expect.arrayContaining(['Behind schedule', 'No recent site updates', 'Handover already moved']),
    );
  });
  it('retries temporary failures but not permanent ones', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          if (calls < 3) throw new Error('busy');
          return 'ok';
        },
        { retries: 3, baseMs: 1 },
      ),
    ).resolves.toBe('ok');
    let permanent = 0;
    await expect(
      withRetry(
        async () => {
          permanent++;
          throw new Error('bad key');
        },
        { retries: 3, baseMs: 1, isRetryable: () => false },
      ),
    ).rejects.toThrow('bad key');
    expect(permanent).toBe(1);
  });
});
