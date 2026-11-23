import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export class UpdateOrganizationDto {
  /** Company name shown to buyers, on receipts and in emails. */
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;

  /** Main brand colour, e.g. #1F2A37. */
  @IsOptional() @Matches(HEX, { message: 'primaryColor must be a colour like #1F2A37' }) primaryColor?: string;

  /** Highlight colour, e.g. #C8A24A. */
  @IsOptional() @Matches(HEX, { message: 'accentColor must be a colour like #C8A24A' }) accentColor?: string;

  /** Start of every receipt number (PIP-2026-000041). Must be unique, because receipt numbers are unique across all companies. */
  @IsOptional() @Matches(/^[A-Z]{2,6}$/, { message: 'receiptPrefix must be 2 to 6 capital letters' }) receiptPrefix?: string;

  /** Days a buyer gets to pay after a linked stage is finished. */
  @IsOptional() @IsInt() @Min(0) @Max(90) milestoneGraceDays?: number;

  /** Monthly AI spending cap in US dollars (Google bills in dollars). 0 turns AI off. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1000) aiMonthlyBudgetUsd?: number;
}
