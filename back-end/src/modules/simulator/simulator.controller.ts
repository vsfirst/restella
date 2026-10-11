import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { ListSimulationsQueryDto } from './dto/list-simulations-query.dto.js';
import { RunSimulationRequestDto } from './dto/run-simulation-request.dto.js';
import { SetFaultsRequestDto } from './dto/set-faults-request.dto.js';
import { ChannelFaultResponseDto, SimulationRunResponseDto } from './dto/simulation-response.dto.js';
import { SimulatedChannelsStore } from './simulated-channels.store.js';
import { SimulatorService } from './simulator.service.js';

/** 채널 코드 → 장애 설정 */
const FAULTS_SCHEMA = { type: 'object', additionalProperties: { $ref: getSchemaPath(ChannelFaultResponseDto) } } as const;

@ApiTags('simulations')
@ApiBearerAuth()
@ApiExtraModels(ChannelFaultResponseDto)
@Controller('api/v1/simulations')
export class SimulatorController {
  constructor(
    private readonly simulator: SimulatorService,
    private readonly store: SimulatedChannelsStore,
  ) {}

  /** 동기로 처리한다. 50건 기준 10초 안에 끝나야 한다 (NFR-02) */
  @Post()
  @ApiOkResponse({ type: SimulationRunResponseDto })
  run(@Body() body: RunSimulationRequestDto, @Headers('authorization') authorization: string): Promise<SimulationRunResponseDto> {
    return this.simulator.run(body, authorization);
  }

  @Get()
  @ApiOkResponse({ type: [SimulationRunResponseDto] })
  list(@Query() q: ListSimulationsQueryDto): Promise<SimulationRunResponseDto[]> {
    return this.simulator.list(q.limit);
  }

  /** 가짜 채널 장애 주입 설정 (재시도 시연용) */
  @Get('faults')
  @ApiOkResponse({ schema: FAULTS_SCHEMA })
  faults(): Record<string, ChannelFaultResponseDto> {
    return this.store.snapshot().faults;
  }

  @Put('faults')
  @ApiOkResponse({ schema: FAULTS_SCHEMA })
  setFaults(@Body() body: SetFaultsRequestDto): Record<string, ChannelFaultResponseDto> {
    this.store.setFaults(body.faults);
    return this.store.snapshot().faults;
  }

  /** 가짜 채널들이 받은 값 초기화 */
  @Delete('channels-state')
  @HttpCode(204)
  @ApiNoContentResponse()
  resetChannels(): void {
    this.store.reset();
  }

  @Get(':id')
  @ApiOkResponse({ type: SimulationRunResponseDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<SimulationRunResponseDto> {
    return this.simulator.get(id);
  }
}
