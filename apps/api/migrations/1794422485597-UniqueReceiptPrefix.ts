import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * payments.receiptNumber is unique across the whole database, so two companies
 * with the same receipt prefix would clash on their first payment of the year.
 */
export class UniqueReceiptPrefix1794422485597 implements MigrationInterface {
  name = 'UniqueReceiptPrefix1794422485597';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD CONSTRAINT "UQ_organizations_receiptPrefix" UNIQUE ("receiptPrefix")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" DROP CONSTRAINT "UQ_organizations_receiptPrefix"`);
  }
}
