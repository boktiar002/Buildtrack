import { IsIn } from 'class-validator';
import { Role } from '../../../common/enums';
import { CreateUserDto } from './create-user.dto';

export class CreateStaffDto extends CreateUserDto {
  @IsIn([Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER]) role: Role;
}
