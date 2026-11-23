import { MigrationInterface, QueryRunner } from 'typeorm';

export class CheckConstraints1794240786642 implements MigrationInterface {
  name = 'CheckConstraints1794240786642';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "CHK_milestone_weight" CHECK ("weight" BETWEEN 1 AND 100)`);
    await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "CHK_milestone_progress" CHECK ("progress" BETWEEN 0 AND 100)`);
    await queryRunner.query(
      `ALTER TABLE "installments" ADD CONSTRAINT "CHK_installment_paid" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "amount")`,
    );
    await queryRunner.query(`ALTER TABLE "installments" ADD CONSTRAINT "CHK_installment_amount" CHECK ("amount" > 0)`);
    await queryRunner.query(`ALTER TABLE "units" ADD CONSTRAINT "CHK_unit_size" CHECK ("sizeSqft" > 0)`);
    await queryRunner.query(`ALTER TABLE "units" ADD CONSTRAINT "CHK_unit_price" CHECK ("listPrice" > 0)`);
    await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "CHK_purchase_total" CHECK ("totalPrice" > 0)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "CHK_payment_amount" CHECK ("amount" > 0)`);
    await queryRunner.query(`ALTER TABLE "payment_allocations" ADD CONSTRAINT "CHK_allocation_amount" CHECK ("amount" > 0)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "CHK_allocation_amount"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "CHK_payment_amount"`);
    await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "CHK_purchase_total"`);
    await queryRunner.query(`ALTER TABLE "units" DROP CONSTRAINT "CHK_unit_price"`);
    await queryRunner.query(`ALTER TABLE "units" DROP CONSTRAINT "CHK_unit_size"`);
    await queryRunner.query(`ALTER TABLE "installments" DROP CONSTRAINT "CHK_installment_amount"`);
    await queryRunner.query(`ALTER TABLE "installments" DROP CONSTRAINT "CHK_installment_paid"`);
    await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "CHK_milestone_progress"`);
    await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "CHK_milestone_weight"`);
  }
}
