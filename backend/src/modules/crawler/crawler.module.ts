import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { CrawlerService } from './crawler.service';
import { CrawlerProcessor } from './crawler.processor';
import { ExtractionModule } from '../extraction/extraction.module';
import { VfsModule } from '../vfs/vfs.module';
import { CRAWL_QUEUE_NAME } from './crawler.queue';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          // Parse rediss:// or redis:// URL manually for full ioredis compatibility
          // Format: rediss://default:PASSWORD@HOST:PORT
          const url = new URL(redisUrl);
          const isTls = redisUrl.startsWith('rediss://');
          return {
            redis: {
              host: url.hostname,
              port: Number(url.port) || 6379,
              password: url.password || undefined,
              username: url.username && url.username !== 'default' ? url.username : undefined,
              tls: isTls ? {} : undefined,
              connectTimeout: 8000,
              maxRetriesPerRequest: 3,
            },
          };
        }
        return {
          redis: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            enableOfflineQueue: false,
            lazyConnect: true,
            connectTimeout: 3000,
            maxRetriesPerRequest: 0,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: CRAWL_QUEUE_NAME,
    }),
    ExtractionModule,
    VfsModule,
  ],
  providers: [CrawlerService, CrawlerProcessor],
  exports: [CrawlerService, BullModule],
})
export class CrawlerModule {}
