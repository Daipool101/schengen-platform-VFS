import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CountriesModule } from './modules/countries/countries.module';
import { VisaRoutesModule } from './modules/visa-routes/visa-routes.module';
import { RequirementsModule } from './modules/requirements/requirements.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { VacCentersModule } from './modules/vac-centers/vac-centers.module';
import { AdvisoriesModule } from './modules/advisories/advisories.module';
import { EsimModule } from './modules/esim/esim.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    CountriesModule,
    VisaRoutesModule,
    RequirementsModule,
    DocumentsModule,
    VacCentersModule,
    AdvisoriesModule,
    EsimModule,
    ExchangeRatesModule,
    CrawlerModule,
    SchedulerModule,
    ExtractionModule,
  ],
})
export class AppModule {}
