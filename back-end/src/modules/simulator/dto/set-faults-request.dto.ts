import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import type { ChannelFault } from '../simulated-channels.store.js';
import { ChannelFaultResponseDto } from './simulation-response.dto.js';

export class SetFaultsRequestDto {
  /** 채널 코드별 장애 설정. 예: {"OTA_C": {"failureRate": 0.3, "delayMs": 200}}. 빠진 채널은 정상으로 돌아간다 */
  @ApiProperty({ type: 'object', additionalProperties: { $ref: getSchemaPath(ChannelFaultResponseDto) } })
  @IsObject()
  faults: Record<string, Partial<ChannelFault>>;
}
