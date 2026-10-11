import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomType } from './room-type.entity.js';

@Injectable()
export class RoomTypeService {
  constructor(@InjectRepository(RoomType) private readonly repo: Repository<RoomType>) {}

  list(): Promise<RoomType[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  findByCode(code: string): Promise<RoomType | null> {
    return this.repo.findOneBy({ code });
  }

  findById(id: number): Promise<RoomType | null> {
    return this.repo.findOneBy({ id });
  }
}
