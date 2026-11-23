import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateUnitsDto } from './dto/create-units.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { FinanceService } from './finance.service';

const STAFF = [Role.ORG_ADMIN, Role.MANAGER] as const;

@ApiTags('units')
@Roles(...STAFF)
@Controller()
export class UnitsController {
  constructor(private readonly finance: FinanceService) {}

  @ApiOperation({ summary: 'List flats of a project; filter by status and code' })
  @Get('projects/:id/units')
  list(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: UnitQueryDto) {
    return this.finance.listUnits(u, id, q);
  }

  @ApiOperation({ summary: 'Add one or more flats' })
  @Post('projects/:id/units')
  @ResponseMessage('Flats added')
  create(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateUnitsDto) {
    return this.finance.createUnits(u, id, dto.units);
  }

  @ApiOperation({ summary: 'Add flats from a CSV file' })
  @Post('projects/:id/units/import')
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Flats imported')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }))
  import(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please choose a CSV file.');
    return this.finance.createUnits(u, id, this.finance.parseUnitsCsv(file.buffer.toString('utf8')));
  }

  @ApiOperation({ summary: 'Get one flat with its booking' })
  @Get('units/:id')
  findOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.finance.unitDetail(u, id);
  }

  @ApiOperation({ summary: 'Update a flat' })
  @Patch('units/:id')
  @ResponseMessage('Flat updated')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.finance.updateUnit(u, id, dto);
  }

  @ApiOperation({ summary: 'Delete a flat that was never booked' })
  @Delete('units/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.finance.deleteUnit(u, id);
  }
}
