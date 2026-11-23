import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeHandoverDto {
  @IsDateString() newDate: string;
  @IsString() @MinLength(20, { message: 'Please explain the reason in at least 20 characters.' }) @MaxLength(1000) reason: string;
}
