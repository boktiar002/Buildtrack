export type Role = 'ORG_ADMIN' | 'MANAGER' | 'ENGINEER' | 'BUYER';

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  organization: { id: string; name: string; slug: string; primaryColor: string; accentColor: string; logoUrl: string | null };
}

export interface Stage {
  id: string;
  name: string;
  sortOrder: number;
  weight: number;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  completedAt: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  location: string;
  description: string | null;
  totalFloors: number;
  status: string;
  startDate: string | null;
  originalHandoverDate: string;
  expectedHandoverDate: string;
  isPublic: boolean;
  coverImageUrl: string | null;
  overallProgress: number;
  currentStage: { id: string; name: string; progress: number } | null;
  stageCount: number;
  completedStages: number;
  delayDays: number;
  risk: { level: 'LOW' | 'MEDIUM' | 'HIGH'; score: number; computedAt: string } | null;
}

export interface HandoverChange {
  id: string;
  oldDate: string;
  newDate: string;
  reason: string;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  milestones: Stage[];
  handoverHistory: HandoverChange[];
  unitCounts?: Array<{ status: string; count: number }>;
  pendingUpdates?: number;
  engineers?: Array<{ id: string; name: string; email: string }>;
}

export interface Photo {
  id: string;
  caption: string | null;
  url: string;
  thumbUrl: string;
  analysis?: {
    suggestedMilestoneId: string | null;
    suggestedProgress: number | null;
    confidence: number | null;
    warnings: string[];
    description: string | null;
    model: string;
    accepted: boolean | null;
  };
}

export interface Update {
  id: string;
  projectId: string;
  projectName?: string;
  milestoneId: string | null;
  milestoneName: string | null;
  authorId: string;
  authorName: string | null;
  title: string;
  text: string | null;
  engineerNote?: string | null;
  progressAfter: number | null;
  status: string;
  rejectReason?: string | null;
  approvedAt: string | null;
  createdAt: string;
  photos: Photo[];
  aiDraft?: { text: string; model: string; decision: string };
}

export interface Suggestion {
  milestoneId: string | null;
  milestoneName: string | null;
  progress: number | null;
  confidence: number | null;
  description: string;
  source: 'ai' | 'fallback' | 'offline';
  notice?: string;
  photos: Array<{ photoId: string; warnings: string[] }>;
}

export interface Installment {
  id: string;
  label: string;
  sortOrder: number;
  amount: string;
  paidAmount: string;
  dueType: 'FIXED_DATE' | 'MILESTONE';
  dueDate: string | null;
  status: string;
  milestone: { id: string; name: string; status: string } | null;
}

export interface Payment {
  id: string;
  amount: string;
  method: string;
  reference: string | null;
  paidAt: string;
  receiptNumber: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface PurchaseDetail {
  id: string;
  status: string;
  bookingDate: string;
  totalPrice: string;
  notes: string | null;
  unit: { id: string; code: string; floor: number; sizeSqft: number; bedrooms: number | null; projectId: string; project: ProjectSummary };
  buyer: { id: string; name: string; email: string; phone: string | null };
  installments: Installment[];
  payments: Payment[];
  totals: { total: string; paid: string; waived: string; balance: string; percentPaid: number };
  nextInstallment: Installment | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}
