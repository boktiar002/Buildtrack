import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEmail() @MaxLength(200) email: string;
  @IsOptional() @Matches(/^\+?[0-9 -]{7,20}$/, { message: 'phone must be a valid phone number' }) phone?: string;
}
