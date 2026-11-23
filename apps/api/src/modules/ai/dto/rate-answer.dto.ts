import { IsBoolean } from 'class-validator';

export class RateAnswerDto {
  @IsBoolean() helpful: boolean;
}
