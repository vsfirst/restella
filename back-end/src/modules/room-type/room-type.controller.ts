import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RoomTypeResponseDto } from './dto/room-type-response.dto.js';
import { RoomTypeService } from './room-type.service.js';

@ApiTags('room-types')
@ApiBearerAuth()
@Controller('api/v1/room-types')
export class RoomTypeController {
  constructor(private readonly roomTypes: RoomTypeService) {}

  @Get()
  @ApiOkResponse({ type: [RoomTypeResponseDto] })
  async list(): Promise<RoomTypeResponseDto[]> {
    const roomTypes = await this.roomTypes.list();
    return roomTypes.map(({ id, code, name }) => ({ id, code, name }));
  }
}
