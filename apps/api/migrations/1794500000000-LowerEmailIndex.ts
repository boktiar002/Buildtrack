import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login, registration and password reset all search with lower(email), which
 * the plain email index cannot serve. This index makes those lookups fast and
 * also stops "A@x.com" and "a@x.com" from existing as two accounts.
 */
export class LowerEmailIndex1794500000000 implements MigrationInterface {
  name = 'LowerEmailIndex1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email_lower" ON "users" (lower("email"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_users_email_lower"`);
  }
}
