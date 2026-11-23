import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProgressUpdateDto {
  @IsString() @MinLength(3) @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
