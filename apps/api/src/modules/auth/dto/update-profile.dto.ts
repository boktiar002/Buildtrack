import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @Matches(/^\+?[0-9 -]{7,20}$/, { message: 'phone must be a valid phone number' }) phone?: string;
}
