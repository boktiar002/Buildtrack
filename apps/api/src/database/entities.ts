import { AiPhotoAnalysis } from '../modules/ai/entities/ai-photo-analysis.entity';
import { AiUpdateDraft } from '../modules/ai/entities/ai-update-draft.entity';
import { AiUsageLog } from '../modules/ai/entities/ai-usage-log.entity';
import { AssistantConversation } from '../modules/ai/entities/assistant-conversation.entity';
import { AssistantMessage } from '../modules/ai/entities/assistant-message.entity';
import { DelayRiskScore } from '../modules/ai/entities/delay-risk-score.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { DocumentChunk } from '../modules/documents/entities/document-chunk.entity';
import { DocumentEntity } from '../modules/documents/entities/document.entity';
import { Installment } from '../modules/finance/entities/installment.entity';
import { PaymentAllocation } from '../modules/finance/entities/payment-allocation.entity';
import { Payment } from '../modules/finance/entities/payment.entity';
import { Purchase } from '../modules/finance/entities/purchase.entity';
import { ReceiptCounter } from '../modules/finance/entities/receipt-counter.entity';
import { Unit } from '../modules/finance/entities/unit.entity';
import { NotificationLog } from '../modules/notifications/entities/notification-log.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { HandoverDateChange } from '../modules/projects/entities/handover-date-change.entity';
import { Milestone } from '../modules/projects/entities/milestone.entity';
import { ProjectAssignment } from '../modules/projects/entities/project-assignment.entity';
import { Project } from '../modules/projects/entities/project.entity';
import { TicketMessage } from '../modules/tickets/entities/ticket-message.entity';
import { Ticket } from '../modules/tickets/entities/ticket.entity';
import { ProgressPhoto } from '../modules/updates/entities/progress-photo.entity';
import { ProgressUpdate } from '../modules/updates/entities/progress-update.entity';
import { Organization } from '../modules/users/entities/organization.entity';
import { User } from '../modules/users/entities/user.entity';

export const ENTITIES = [
  Organization,
  User,
  ProjectAssignment,
  Project,
  Milestone,
  ProgressUpdate,
  ProgressPhoto,
  Unit,
  Purchase,
  Installment,
  ReceiptCounter,
  Payment,
  PaymentAllocation,
  HandoverDateChange,
  DocumentEntity,
  Ticket,
  TicketMessage,
  Notification,
  NotificationLog,
  AuditLog,
  RefreshToken,
  PasswordResetToken,
  AiPhotoAnalysis,
  AiUpdateDraft,
  DocumentChunk,
  AssistantConversation,
  AssistantMessage,
  DelayRiskScore,
  AiUsageLog,
];
