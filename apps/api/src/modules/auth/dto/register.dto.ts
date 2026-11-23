import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  /** Full name as it should appear on receipts. */
  @IsString() @MinLength(2) @MaxLength(120) name: string;

  /** Login email; must not already be registered. */
  @IsEmail() @MaxLength(200) email: string;

  /** At least 8 characters with at least one letter and one number. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain at least one letter and one number' })
  password: string;

  /** Bangladeshi mobile number for SMS reminders, e.g. +8801712345678. */
  @IsOptional()
  @Matches(/^\+?8801[3-9]\d{8}$/, { message: 'phone must be a Bangladeshi mobile number like +8801712345678' })
  phone?: string;

  /** The developer's code (defaults to the pilot developer). */
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]{2,40}$/) organizationSlug?: string;
}
