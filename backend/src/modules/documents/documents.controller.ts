import { Controller, Get, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':origin/:destination')
  async findByOriginDestination(
    @Param('origin') origin: string,
    @Param('destination') destination: string,
  ) {
    return this.documentsService.findByOriginDestination(origin, destination);
  }
}
