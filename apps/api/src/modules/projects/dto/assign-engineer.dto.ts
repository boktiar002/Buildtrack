import { IsUUID } from 'class-validator';

export class AssignEngineerDto {
  @IsUUID() userId: string;
}
