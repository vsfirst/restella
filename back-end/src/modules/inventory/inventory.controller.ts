import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentOperator } from '../../common/auth/current-operator.decorator.js';
import type { OperatorPrincipal } from '../../common/auth/operator-auth.guard.js';
import { DateRangeQueryDto } from '../../common/http/date-range-query.dto.js';
import { AdjustInventoryRequestDto } from './dto/adjust-inventory-request.dto.js';
import { AdjustInventoryResponseDto, InventoryCalendarResponseDto } from './dto/inventory-response.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOkResponse({ type: [InventoryCalendarResponseDto] })
  calendar(@Query() q: DateRangeQueryDto): Promise<InventoryCalendarResponseDto[]> {
    q.assertRange();
    return this.inventory.calendar(q.from, q.to);
  }

  @Patch(':roomTypeId/:stayDate')
  @ApiOkResponse({ type: AdjustInventoryResponseDto })
  adjust(
    @Param('roomTypeId', ParseIntPipe) roomTypeId: number,
    @Param('stayDate') stayDate: string,
    @Body() body: AdjustInventoryRequestDto,
    @CurrentOperator() operator: OperatorPrincipal,
  ): Promise<AdjustInventoryResponseDto> {
    assertDateParam(stayDate);
    return this.inventory.adjustTotal(roomTypeId, stayDate, body.totalRooms, `OPERATOR:${operator.id}`, body.source);
  }
}

function assertDateParam(value: string): void {
  const range = new DateRangeQueryDto();
  range.from = value;
  range.to = value;
  range.assertRange();
}
