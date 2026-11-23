import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794034798725 implements MigrationInterface {
  name = 'InitialSchema1794034798725';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "logoUrl" text, "primaryColor" character varying NOT NULL DEFAULT '#1F2A37', "accentColor" character varying NOT NULL DEFAULT '#C8A24A', "receiptPrefix" character varying NOT NULL DEFAULT 'RCP', "milestoneGraceDays" integer NOT NULL DEFAULT '15', "aiMonthlyBudgetUsd" numeric(10,2) NOT NULL DEFAULT '5', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ORG_ADMIN', 'MANAGER', 'ENGINEER', 'BUYER')`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "role" "public"."users_role_enum" NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "phone" text, "passwordHash" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_f3d6aea8fcca58182b2e80ce97" ON "users" ("organizationId") `);
    await queryRunner.query(
      `CREATE TABLE "project_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "UQ_6a643914105fd55b237b66a0855" UNIQUE ("projectId", "userId"), CONSTRAINT "PK_045df8f32ae1d54810b39b9c7bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_2de237ae3bf6566e76fa428199" ON "project_assignments" ("userId") `);
    await queryRunner.query(
      `CREATE TYPE "public"."projects_status_enum" AS ENUM('PLANNING', 'UNDER_CONSTRUCTION', 'COMPLETED', 'HANDED_OVER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "location" character varying NOT NULL, "description" text, "coverImageKey" text, "totalFloors" integer NOT NULL, "status" "public"."projects_status_enum" NOT NULL DEFAULT 'PLANNING', "startDate" TIMESTAMP WITH TIME ZONE, "originalHandoverDate" TIMESTAMP WITH TIME ZONE NOT NULL, "expectedHandoverDate" TIMESTAMP WITH TIME ZONE NOT NULL, "isPublic" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_72f01c3b3eed28a8785bf997ead" UNIQUE ("organizationId", "slug"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_eec93fd979bdcf5a0141da324d" ON "projects" ("organizationId") `);
    await queryRunner.query(`CREATE TYPE "public"."milestones_status_enum" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')`);
    await queryRunner.query(
      `CREATE TABLE "milestones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "name" character varying NOT NULL, "sortOrder" integer NOT NULL, "weight" integer NOT NULL, "progress" integer NOT NULL DEFAULT '0', "status" "public"."milestones_status_enum" NOT NULL DEFAULT 'NOT_STARTED', "plannedStart" TIMESTAMP WITH TIME ZONE, "plannedEnd" TIMESTAMP WITH TIME ZONE, "actualStart" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_dc10748347a6177f99418faa83" ON "milestones" ("projectId", "sortOrder") `);
    await queryRunner.query(
      `CREATE TYPE "public"."progress_updates_status_enum" AS ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "progress_updates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "milestoneId" uuid, "authorId" uuid NOT NULL, "title" character varying NOT NULL, "engineerNote" text, "publishedText" text, "progressAfter" integer, "status" "public"."progress_updates_status_enum" NOT NULL DEFAULT 'DRAFT', "rejectReason" text, "approvedById" uuid, "approvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_180f6781848cb83b31c3deb131b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_89747eab67eb8fe32f32427adb" ON "progress_updates" ("authorId") `);
    await queryRunner.query(`CREATE INDEX "IDX_5df5c321069b11a26fa50b3e9a" ON "progress_updates" ("milestoneId") `);
    await queryRunner.query(`CREATE INDEX "IDX_348875e2653f6613bdabff0186" ON "progress_updates" ("projectId", "status", "createdAt") `);
    await queryRunner.query(
      `CREATE TABLE "progress_photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "updateId" uuid NOT NULL, "fileKey" character varying NOT NULL, "thumbKey" character varying NOT NULL, "caption" text, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5396497e4283c10ac55ad4c9e7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_9bdbb392da847899cb005712bf" ON "progress_photos" ("updateId") `);
    await queryRunner.query(`CREATE TYPE "public"."units_status_enum" AS ENUM('AVAILABLE', 'BOOKED', 'SOLD')`);
    await queryRunner.query(
      `CREATE TABLE "units" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "code" character varying NOT NULL, "floor" integer NOT NULL, "sizeSqft" integer NOT NULL, "bedrooms" integer, "listPrice" numeric(14,2) NOT NULL, "status" "public"."units_status_enum" NOT NULL DEFAULT 'AVAILABLE', CONSTRAINT "UQ_c863b88a7a1e4cfc53ebfbe6f2a" UNIQUE ("projectId", "code"), CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."purchases_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'CANCELLED')`);
    await queryRunner.query(
      `CREATE TABLE "purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "unitId" uuid NOT NULL, "buyerId" uuid NOT NULL, "bookingDate" TIMESTAMP WITH TIME ZONE NOT NULL, "totalPrice" numeric(14,2) NOT NULL, "status" "public"."purchases_status_enum" NOT NULL DEFAULT 'ACTIVE', "notes" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1d55032f37a34c6eceacbbca6b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_22533450a1d627dc3ae071f22a" ON "purchases" ("buyerId") `);
    await queryRunner.query(`CREATE INDEX "IDX_87f5670b1e20542e20660fc3af" ON "purchases" ("unitId") `);
    await queryRunner.query(`CREATE TYPE "public"."installments_duetype_enum" AS ENUM('FIXED_DATE', 'MILESTONE')`);
    await queryRunner.query(
      `CREATE TYPE "public"."installments_status_enum" AS ENUM('UPCOMING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "installments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchaseId" uuid NOT NULL, "label" character varying NOT NULL, "sortOrder" integer NOT NULL, "amount" numeric(14,2) NOT NULL, "dueType" "public"."installments_duetype_enum" NOT NULL, "dueDate" TIMESTAMP WITH TIME ZONE, "milestoneId" uuid, "paidAmount" numeric(14,2) NOT NULL DEFAULT '0', "status" "public"."installments_status_enum" NOT NULL DEFAULT 'UPCOMING', "waiveReason" text, CONSTRAINT "PK_c74e44aa06bdebef2af0a93da1b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_050818bec2a573ce4cff9054e8" ON "installments" ("status", "dueDate") `);
    await queryRunner.query(`CREATE INDEX "IDX_30a6fa37f1d70e97b4ec4bf7c8" ON "installments" ("milestoneId") `);
    await queryRunner.query(`CREATE INDEX "IDX_0369f0f95fe55e8194c956b3ce" ON "installments" ("purchaseId", "sortOrder") `);
    await queryRunner.query(
      `CREATE TABLE "receipt_counters" ("organizationId" uuid NOT NULL, "year" integer NOT NULL, "last" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_87be1129cf201b5947aaf893081" PRIMARY KEY ("organizationId", "year"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_method_enum" AS ENUM('BKASH', 'NAGAD', 'BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchaseId" uuid NOT NULL, "amount" numeric(14,2) NOT NULL, "method" "public"."payments_method_enum" NOT NULL, "reference" text, "paidAt" TIMESTAMP WITH TIME ZONE NOT NULL, "receiptNumber" character varying NOT NULL, "recordedById" uuid NOT NULL, "voidedAt" TIMESTAMP WITH TIME ZONE, "voidReason" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ccf1990399854743306e7ab8523" UNIQUE ("receiptNumber"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_939f03487247fc2bdbc4ff6ab8" ON "payments" ("paidAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_d233e4715a24816e80fb5af70b" ON "payments" ("purchaseId") `);
    await queryRunner.query(
      `CREATE TABLE "payment_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "paymentId" uuid NOT NULL, "installmentId" uuid NOT NULL, "amount" numeric(14,2) NOT NULL, CONSTRAINT "PK_a5c6ff22065ac772620c85f4efb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_e50f7a6e0af44c962f49ca842f" ON "payment_allocations" ("installmentId") `);
    await queryRunner.query(`CREATE INDEX "IDX_68129272bde8768a20d6967a62" ON "payment_allocations" ("paymentId") `);
    await queryRunner.query(
      `CREATE TABLE "handover_date_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "oldDate" TIMESTAMP WITH TIME ZONE NOT NULL, "newDate" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" text NOT NULL, "changedById" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5d5bd96540fed22a9c08e4d06a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_38de1629649127e3e01367155b" ON "handover_date_changes" ("projectId", "createdAt") `);
    await queryRunner.query(
      `CREATE TYPE "public"."documents_type_enum" AS ENUM('ALLOTMENT_LETTER', 'AGREEMENT', 'RECEIPT', 'APPROVAL', 'FLOOR_PLAN', 'OTHER')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."documents_visibility_enum" AS ENUM('INTERNAL', 'PROJECT_BUYERS', 'PURCHASE_BUYER')`);
    await queryRunner.query(`CREATE TYPE "public"."documents_indexstatus_enum" AS ENUM('NOT_INDEXED', 'INDEXED', 'FAILED')`);
    await queryRunner.query(
      `CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "projectId" uuid, "purchaseId" uuid, "title" character varying NOT NULL, "type" "public"."documents_type_enum" NOT NULL, "visibility" "public"."documents_visibility_enum" NOT NULL, "fileKey" character varying NOT NULL, "mimeType" character varying NOT NULL, "sizeBytes" integer NOT NULL, "uploadedById" uuid NOT NULL, "indexStatus" "public"."documents_indexstatus_enum" NOT NULL DEFAULT 'NOT_INDEXED', "indexError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_c9a579ef53b6cf72ee478e73da" ON "documents" ("purchaseId") `);
    await queryRunner.query(`CREATE INDEX "IDX_fe6ebd6e679c0feee3a7ecc035" ON "documents" ("projectId") `);
    await queryRunner.query(`CREATE INDEX "IDX_f16eaa571c8fc0ee214cad0f1c" ON "documents" ("organizationId") `);
    await queryRunner.query(`CREATE TYPE "public"."tickets_status_enum" AS ENUM('OPEN', 'ANSWERED', 'CLOSED')`);
    await queryRunner.query(
      `CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchaseId" uuid NOT NULL, "subject" character varying NOT NULL, "status" "public"."tickets_status_enum" NOT NULL DEFAULT 'OPEN', "fromAi" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_12b901b34113688b4786368510" ON "tickets" ("status") `);
    await queryRunner.query(`CREATE INDEX "IDX_70b4b94dc3d3d4ecc0d7bda4e0" ON "tickets" ("purchaseId") `);
    await queryRunner.query(
      `CREATE TABLE "ticket_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticketId" uuid NOT NULL, "authorId" uuid NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_37beb692dedf7eccb4e519ccec1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_b01e2a35417efbe04c10828266" ON "ticket_messages" ("ticketId") `);
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL, "link" text, "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_bf6a7beea9f7cd8633c8699605" ON "notifications" ("userId", "readAt", "createdAt") `);
    await queryRunner.query(`CREATE TYPE "public"."notification_logs_channel_enum" AS ENUM('IN_APP', 'EMAIL', 'SMS')`);
    await queryRunner.query(
      `CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "channel" "public"."notification_logs_channel_enum" NOT NULL, "type" character varying NOT NULL, "dedupeKey" character varying NOT NULL, "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_68c994ee472165ab8857200dfdd" UNIQUE ("dedupeKey"), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "actorId" uuid NOT NULL, "action" character varying NOT NULL, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "meta" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_9885c0f9a2e4081ebae4313d87" ON "audit_logs" ("organizationId", "createdAt") `);
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06" UNIQUE ("tokenHash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_1143abb8c3fad8b06dd857a8c9c" UNIQUE ("tokenHash"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_photo_analyses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "photoId" uuid NOT NULL, "suggestedMilestoneId" uuid, "suggestedProgress" integer, "confidence" real, "qualityWarnings" text array NOT NULL DEFAULT '{}', "description" text, "model" character varying NOT NULL, "accepted" boolean, "correctedMilestoneId" uuid, "correctedProgress" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d5fe21da66df966de37ad6998a0" UNIQUE ("photoId"), CONSTRAINT "REL_d5fe21da66df966de37ad6998a" UNIQUE ("photoId"), CONSTRAINT "PK_fd5170371cfda4b24eaf89036ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."ai_update_drafts_decision_enum" AS ENUM('PENDING', 'APPROVED', 'EDITED', 'REJECTED')`);
    await queryRunner.query(
      `CREATE TABLE "ai_update_drafts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "updateId" uuid NOT NULL, "generated" text NOT NULL, "model" character varying NOT NULL, "editedText" text, "decision" "public"."ai_update_drafts_decision_enum" NOT NULL DEFAULT 'PENDING', "reviewerId" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_03729a948ac3c00c911d0f6d60d" UNIQUE ("updateId"), CONSTRAINT "REL_03729a948ac3c00c911d0f6d60" UNIQUE ("updateId"), CONSTRAINT "PK_056cf4bab30c891df13145a4318" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_chunks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentId" uuid NOT NULL, "chunkIndex" integer NOT NULL, "text" text NOT NULL, "embedding" double precision array NOT NULL, "embeddingModel" character varying NOT NULL, CONSTRAINT "PK_7f9060084e9b872dbb567193978" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_eaf9afaf30fb7e2ac25989db51" ON "document_chunks" ("documentId") `);
    await queryRunner.query(
      `CREATE TABLE "assistant_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "buyerId" uuid NOT NULL, "purchaseId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba3c0e4c991d8449c4c80dcc866" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_0c3b33e66dca62c256adfe3e54" ON "assistant_conversations" ("buyerId", "createdAt") `);
    await queryRunner.query(
      `CREATE TABLE "assistant_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "role" character varying NOT NULL, "text" text NOT NULL, "sources" jsonb, "unsure" boolean NOT NULL DEFAULT false, "helpful" boolean, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2e3cd3325f853089044baca6b77" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_5efd561429af6400e2e691e180" ON "assistant_messages" ("conversationId", "createdAt") `);
    await queryRunner.query(`CREATE TYPE "public"."delay_risk_scores_level_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`);
    await queryRunner.query(
      `CREATE TABLE "delay_risk_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "milestoneId" uuid, "score" integer NOT NULL, "level" "public"."delay_risk_scores_level_enum" NOT NULL, "factors" jsonb NOT NULL, "explanation" text, "computedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_369482ed9ef95b48a72b2b0e2a9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_4e556cc8c6c49ddb7b69085c38" ON "delay_risk_scores" ("projectId", "computedAt") `);
    await queryRunner.query(
      `CREATE TABLE "ai_usage_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "userId" uuid, "feature" character varying NOT NULL, "model" character varying NOT NULL, "inputTokens" integer NOT NULL DEFAULT '0', "outputTokens" integer NOT NULL DEFAULT '0', "costUsd" numeric(10,6) NOT NULL DEFAULT '0', "latencyMs" integer NOT NULL, "success" boolean NOT NULL, "error" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f42670987a1de5cb209a77e925" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_164eedd93f04861096766814a2" ON "ai_usage_logs" ("organizationId", "createdAt") `);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_f3d6aea8fcca58182b2e80ce979" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_assignments" ADD CONSTRAINT "FK_9c5f0cbd89c4d1e858a4b4a4e4f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_assignments" ADD CONSTRAINT "FK_2de237ae3bf6566e76fa428199b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_eec93fd979bdcf5a0141da324d6" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "progress_updates" ADD CONSTRAINT "FK_96aa6ce805b7bf8a73e6c221622" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "progress_updates" ADD CONSTRAINT "FK_5df5c321069b11a26fa50b3e9ac" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "progress_updates" ADD CONSTRAINT "FK_89747eab67eb8fe32f32427adbe" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "progress_photos" ADD CONSTRAINT "FK_9bdbb392da847899cb005712bf3" FOREIGN KEY ("updateId") REFERENCES "progress_updates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" ADD CONSTRAINT "FK_e9ae49f078e5267cf076bbb778c" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD CONSTRAINT "FK_87f5670b1e20542e20660fc3af6" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD CONSTRAINT "FK_22533450a1d627dc3ae071f22ae" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "installments" ADD CONSTRAINT "FK_61c2ee4124f9e5dd7401cda0023" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "installments" ADD CONSTRAINT "FK_30a6fa37f1d70e97b4ec4bf7c8c" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_d233e4715a24816e80fb5af70b6" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_68129272bde8768a20d6967a62c" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_e50f7a6e0af44c962f49ca842fd" FOREIGN KEY ("installmentId") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "handover_date_changes" ADD CONSTRAINT "FK_6b38f130b80cf8388aafa1af244" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_fe6ebd6e679c0feee3a7ecc0354" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_c9a579ef53b6cf72ee478e73da0" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD CONSTRAINT "FK_70b4b94dc3d3d4ecc0d7bda4e01" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_messages" ADD CONSTRAINT "FK_b01e2a35417efbe04c10828266f" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_messages" ADD CONSTRAINT "FK_20732d6c17c639f3f155b26cf8b" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_photo_analyses" ADD CONSTRAINT "FK_d5fe21da66df966de37ad6998a0" FOREIGN KEY ("photoId") REFERENCES "progress_photos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_photo_analyses" ADD CONSTRAINT "FK_5d9d2c61c39876a7c2af71aace2" FOREIGN KEY ("suggestedMilestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_update_drafts" ADD CONSTRAINT "FK_03729a948ac3c00c911d0f6d60d" FOREIGN KEY ("updateId") REFERENCES "progress_updates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ADD CONSTRAINT "FK_eaf9afaf30fb7e2ac25989db51b" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD CONSTRAINT "FK_8f3718c903d83c61d967becbb77" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD CONSTRAINT "FK_5ffbd2fdea3e02def0b802f8c4d" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD CONSTRAINT "FK_8e9c052ae338e02911581179386" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delay_risk_scores" ADD CONSTRAINT "FK_fd384a19df679475884ade44769" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delay_risk_scores" DROP CONSTRAINT "FK_fd384a19df679475884ade44769"`);
    await queryRunner.query(`ALTER TABLE "assistant_messages" DROP CONSTRAINT "FK_8e9c052ae338e02911581179386"`);
    await queryRunner.query(`ALTER TABLE "assistant_conversations" DROP CONSTRAINT "FK_5ffbd2fdea3e02def0b802f8c4d"`);
    await queryRunner.query(`ALTER TABLE "assistant_conversations" DROP CONSTRAINT "FK_8f3718c903d83c61d967becbb77"`);
    await queryRunner.query(`ALTER TABLE "document_chunks" DROP CONSTRAINT "FK_eaf9afaf30fb7e2ac25989db51b"`);
    await queryRunner.query(`ALTER TABLE "ai_update_drafts" DROP CONSTRAINT "FK_03729a948ac3c00c911d0f6d60d"`);
    await queryRunner.query(`ALTER TABLE "ai_photo_analyses" DROP CONSTRAINT "FK_5d9d2c61c39876a7c2af71aace2"`);
    await queryRunner.query(`ALTER TABLE "ai_photo_analyses" DROP CONSTRAINT "FK_d5fe21da66df966de37ad6998a0"`);
    await queryRunner.query(`ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
    await queryRunner.query(`ALTER TABLE "ticket_messages" DROP CONSTRAINT "FK_20732d6c17c639f3f155b26cf8b"`);
    await queryRunner.query(`ALTER TABLE "ticket_messages" DROP CONSTRAINT "FK_b01e2a35417efbe04c10828266f"`);
    await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_70b4b94dc3d3d4ecc0d7bda4e01"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_c9a579ef53b6cf72ee478e73da0"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_fe6ebd6e679c0feee3a7ecc0354"`);
    await queryRunner.query(`ALTER TABLE "handover_date_changes" DROP CONSTRAINT "FK_6b38f130b80cf8388aafa1af244"`);
    await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_e50f7a6e0af44c962f49ca842fd"`);
    await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_68129272bde8768a20d6967a62c"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_d233e4715a24816e80fb5af70b6"`);
    await queryRunner.query(`ALTER TABLE "installments" DROP CONSTRAINT "FK_30a6fa37f1d70e97b4ec4bf7c8c"`);
    await queryRunner.query(`ALTER TABLE "installments" DROP CONSTRAINT "FK_61c2ee4124f9e5dd7401cda0023"`);
    await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_22533450a1d627dc3ae071f22ae"`);
    await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_87f5670b1e20542e20660fc3af6"`);
    await queryRunner.query(`ALTER TABLE "units" DROP CONSTRAINT "FK_e9ae49f078e5267cf076bbb778c"`);
    await queryRunner.query(`ALTER TABLE "progress_photos" DROP CONSTRAINT "FK_9bdbb392da847899cb005712bf3"`);
    await queryRunner.query(`ALTER TABLE "progress_updates" DROP CONSTRAINT "FK_89747eab67eb8fe32f32427adbe"`);
    await queryRunner.query(`ALTER TABLE "progress_updates" DROP CONSTRAINT "FK_5df5c321069b11a26fa50b3e9ac"`);
    await queryRunner.query(`ALTER TABLE "progress_updates" DROP CONSTRAINT "FK_96aa6ce805b7bf8a73e6c221622"`);
    await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_eec93fd979bdcf5a0141da324d6"`);
    await queryRunner.query(`ALTER TABLE "project_assignments" DROP CONSTRAINT "FK_2de237ae3bf6566e76fa428199b"`);
    await queryRunner.query(`ALTER TABLE "project_assignments" DROP CONSTRAINT "FK_9c5f0cbd89c4d1e858a4b4a4e4f"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_f3d6aea8fcca58182b2e80ce979"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_164eedd93f04861096766814a2"`);
    await queryRunner.query(`DROP TABLE "ai_usage_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e556cc8c6c49ddb7b69085c38"`);
    await queryRunner.query(`DROP TABLE "delay_risk_scores"`);
    await queryRunner.query(`DROP TYPE "public"."delay_risk_scores_level_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5efd561429af6400e2e691e180"`);
    await queryRunner.query(`DROP TABLE "assistant_messages"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0c3b33e66dca62c256adfe3e54"`);
    await queryRunner.query(`DROP TABLE "assistant_conversations"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_eaf9afaf30fb7e2ac25989db51"`);
    await queryRunner.query(`DROP TABLE "document_chunks"`);
    await queryRunner.query(`DROP TABLE "ai_update_drafts"`);
    await queryRunner.query(`DROP TYPE "public"."ai_update_drafts_decision_enum"`);
    await queryRunner.query(`DROP TABLE "ai_photo_analyses"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9885c0f9a2e4081ebae4313d87"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "notification_logs"`);
    await queryRunner.query(`DROP TYPE "public"."notification_logs_channel_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bf6a7beea9f7cd8633c8699605"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b01e2a35417efbe04c10828266"`);
    await queryRunner.query(`DROP TABLE "ticket_messages"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_70b4b94dc3d3d4ecc0d7bda4e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_12b901b34113688b4786368510"`);
    await queryRunner.query(`DROP TABLE "tickets"`);
    await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f16eaa571c8fc0ee214cad0f1c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fe6ebd6e679c0feee3a7ecc035"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c9a579ef53b6cf72ee478e73da"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TYPE "public"."documents_indexstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."documents_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."documents_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_38de1629649127e3e01367155b"`);
    await queryRunner.query(`DROP TABLE "handover_date_changes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_68129272bde8768a20d6967a62"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e50f7a6e0af44c962f49ca842f"`);
    await queryRunner.query(`DROP TABLE "payment_allocations"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d233e4715a24816e80fb5af70b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_939f03487247fc2bdbc4ff6ab8"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    await queryRunner.query(`DROP TABLE "receipt_counters"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0369f0f95fe55e8194c956b3ce"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_30a6fa37f1d70e97b4ec4bf7c8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_050818bec2a573ce4cff9054e8"`);
    await queryRunner.query(`DROP TABLE "installments"`);
    await queryRunner.query(`DROP TYPE "public"."installments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."installments_duetype_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_87f5670b1e20542e20660fc3af"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_22533450a1d627dc3ae071f22a"`);
    await queryRunner.query(`DROP TABLE "purchases"`);
    await queryRunner.query(`DROP TYPE "public"."purchases_status_enum"`);
    await queryRunner.query(`DROP TABLE "units"`);
    await queryRunner.query(`DROP TYPE "public"."units_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9bdbb392da847899cb005712bf"`);
    await queryRunner.query(`DROP TABLE "progress_photos"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_348875e2653f6613bdabff0186"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5df5c321069b11a26fa50b3e9a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_89747eab67eb8fe32f32427adb"`);
    await queryRunner.query(`DROP TABLE "progress_updates"`);
    await queryRunner.query(`DROP TYPE "public"."progress_updates_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dc10748347a6177f99418faa83"`);
    await queryRunner.query(`DROP TABLE "milestones"`);
    await queryRunner.query(`DROP TYPE "public"."milestones_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_eec93fd979bdcf5a0141da324d"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2de237ae3bf6566e76fa428199"`);
    await queryRunner.query(`DROP TABLE "project_assignments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f3d6aea8fcca58182b2e80ce97"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
