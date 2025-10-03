import type { CreateSeriesInput, UpdateSeriesInput, Series, SeriesFilters } from './schemas';

export interface SeriesRepository {
  create(input: CreateSeriesInput, authorId: string): Promise<Series>;
  update(id: string, input: UpdateSeriesInput): Promise<Series | null>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Series | null>;
  findAll(filters?: SeriesFilters): Promise<Series[]>;
  findByChurchId(churchId: string): Promise<Series[]>;
  findByAuthorId(authorId: string): Promise<Series[]>;
}