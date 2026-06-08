import { Module } from '@nestjs/common';
import { VfsContentfulService } from './vfs-contentful.service';
import { VfsTokenService } from './vfs-token.service';

@Module({
  providers: [VfsContentfulService, VfsTokenService],
  exports: [VfsContentfulService],
})
export class VfsModule {}
