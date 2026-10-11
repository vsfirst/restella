import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentOperator } from '../../common/auth/current-operator.decorator.js';
import type { OperatorPrincipal } from '../../common/auth/operator-auth.guard.js';
import { ConflictService } from './conflict.service.js';
import {
  ConflictCancelledResponseDto,
  ConflictListResponseDto,
  ConflictMovedResponseDto,
  ConflictResolvedResponseDto,
} from './dto/conflict-response.dto.js';
import { ListConflictsQueryDto } from './dto/list-conflicts-query.dto.js';
import { MoveConflictRequestDto } from './dto/move-conflict-request.dto.js';
import { ResolveConflictRequestDto } from './dto/resolve-conflict-request.dto.js';

@ApiTags('conflicts')
@ApiBearerAuth()
@Controller('api/v1/conflicts')
export class ConflictController {
  constructor(private readonly conflicts: ConflictService) {}

  @Get()
  @ApiOkResponse({ type: ConflictListResponseDto })
  list(@Query() q: ListConflictsQueryDto): Promise<ConflictListResponseDto> {
    return this.conflicts.list(q.status, q.limit);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: ConflictCancelledResponseDto })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentOperator() op: OperatorPrincipal): Promise<ConflictCancelledResponseDto> {
    return this.conflicts.cancel(id, op.id);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ApiOkResponse({ type: ConflictResolvedResponseDto })
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResolveConflictRequestDto,
    @CurrentOperator() op: OperatorPrincipal,
  ): Promise<ConflictResolvedResponseDto> {
    return this.conflicts.resolve(id, body.note, op.id);
  }

  @Post(':id/move')
  @HttpCode(200)
  @ApiOkResponse({ type: ConflictMovedResponseDto })
  move(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MoveConflictRequestDto,
    @CurrentOperator() op: OperatorPrincipal,
  ): Promise<ConflictMovedResponseDto> {
    return this.conflicts.move(id, body.roomTypeId, op.id);
  }
}
