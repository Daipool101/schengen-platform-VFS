import { Module } from '@nestjs/common';
import { VfsContentfulService } from './vfs-contentful.service';
import { VfsVisaTypeService } from './vfs-visatype.service';
import { VfsOnePagerService } from './vfs-onepager.service';
import { VfsTokenService } from './vfs-token.service';

@Module({
  providers: [VfsContentfulService, VfsVisaTypeService, VfsOnePagerService, VfsTokenService],
  exports: [VfsContentfulService, VfsVisaTypeService, VfsOnePagerService],
})
export class VfsModule {}
