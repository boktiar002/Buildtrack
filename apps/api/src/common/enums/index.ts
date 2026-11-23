export enum Role {
  ORG_ADMIN = 'ORG_ADMIN',
  MANAGER = 'MANAGER',
  ENGINEER = 'ENGINEER',
  BUYER = 'BUYER',
}
export const STAFF_ROLES = [Role.ORG_ADMIN, Role.MANAGER];

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION',
  COMPLETED = 'COMPLETED',
  HANDED_OVER = 'HANDED_OVER',
}

export enum MilestoneStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum UpdateStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  UNPUBLISHED = 'UNPUBLISHED',
}

export enum UnitStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  SOLD = 'SOLD',
}

export enum PurchaseStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum InstallmentDueType {
  FIXED_DATE = 'FIXED_DATE',
  MILESTONE = 'MILESTONE',
}

export enum InstallmentStatus {
  UPCOMING = 'UPCOMING',
  DUE = 'DUE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export enum PaymentMethod {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

export enum DocumentType {
  ALLOTMENT_LETTER = 'ALLOTMENT_LETTER',
  AGREEMENT = 'AGREEMENT',
  RECEIPT = 'RECEIPT',
  APPROVAL = 'APPROVAL',
  FLOOR_PLAN = 'FLOOR_PLAN',
  OTHER = 'OTHER',
}

export enum DocumentVisibility {
  INTERNAL = 'INTERNAL',
  PROJECT_BUYERS = 'PROJECT_BUYERS',
  PURCHASE_BUYER = 'PURCHASE_BUYER',
}

export enum IndexStatus {
  NOT_INDEXED = 'NOT_INDEXED',
  INDEXED = 'INDEXED',
  FAILED = 'FAILED',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  ANSWERED = 'ANSWERED',
  CLOSED = 'CLOSED',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum AiDraftDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  EDITED = 'EDITED',
  REJECTED = 'REJECTED',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
