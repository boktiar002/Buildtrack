import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReasonDto {
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}
