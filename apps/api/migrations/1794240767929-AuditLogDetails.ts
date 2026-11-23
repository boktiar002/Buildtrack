import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogDetails1794240767929 implements MigrationInterface {
  name = 'AuditLogDetails1794240767929';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "oldValue" jsonb`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "newValue" jsonb`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "ipAddress" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "requestId" character varying(64)`);
    await queryRunner.query(`CREATE INDEX "IDX_2643f2a68c662985433dbddca1" ON "audit_logs" ("entity", "entityId") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_2643f2a68c662985433dbddca1"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "requestId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "ipAddress"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "newValue"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "oldValue"`);
  }
}
