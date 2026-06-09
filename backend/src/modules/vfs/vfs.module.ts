import { Module } from '@nestjs/common';
import { VfsContentfulService } from './vfs-contentful.service';
import { VfsVisaTypeService } from './vfs-visatype.service';
import { VfsTokenService } from './vfs-token.service';

@Module({
  providers: [VfsContentfulService, VfsVisaTypeService, VfsTokenService],
  exports: [VfsContentfulService, VfsVisaTypeService],
})
export class VfsModule {}
