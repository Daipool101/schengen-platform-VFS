import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Manages the Contentful Bearer token that VFS embeds in its frontend.
 * - Starts with the token from env (CONTENTFUL_TOKEN).
 * - If the API returns 401, uses Playwright to load VFS and capture a fresh
 *   token from the live page's network requests (self-healing).
 */
@Injectable()
export class VfsTokenService {
  private readonly logger = new Logger(VfsTokenService.name);
  private cachedToken: string | null = null;
  private refreshing: Promise<string | null> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.cachedToken = this.configService.get<string>('CONTENTFUL_TOKEN') ?? null;
  }

  getToken(): string | null {
    return this.cachedToken;
  }

  /**
   * Captures a fresh token by driving a headless browser to the VFS site
   * and intercepting the Authorization header on its Contentful API calls.
   * De-duplicates concurrent refreshes so only one browser runs at a time.
   */
  async refreshToken(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;

    this.refreshing = this.captureToken()
      .then((token) => {
        if (token) {
          this.cachedToken = token;
          this.logger.log('Captured fresh Contentful token via Playwright');
        } else {
          this.logger.warn('Playwright token capture returned nothing');
        }
        return token;
      })
      .finally(() => {
        this.refreshing = null;
      });

    return this.refreshing;
  }

  private async captureToken(): Promise<string | null> {
    // Lazy import so the app still boots if Playwright/Chromium isn't installed
    let chromium: any;
    try {
      ({ chromium } = await import('playwright'));
    } catch (e) {
      this.logger.error('Playwright not available — cannot refresh token');
      return null;
    }

    const seedUrl =
      this.configService.get<string>('VFS_SEED_URL') ??
      'https://visa.vfsglobal.com/ind/en/deu/';

    let browser: any;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 900 },
        locale: 'en-US',
      });
      const page = await context.newPage();

      let token: string | null = null;
      page.on('request', (req: any) => {
        const url = req.url();
        if (url.includes('cloudfront.net') && url.includes('/entries?')) {
          const auth = req.headers()['authorization'];
          if (auth?.startsWith('Bearer ')) {
            token = auth.replace('Bearer ', '').trim();
          }
        }
      });

      await page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      // Wait for the Contentful calls to fire
      for (let i = 0; i < 12 && !token; i++) {
        await page.waitForTimeout(1000);
      }

      return token;
    } catch (e) {
      this.logger.error(
        `Playwright token capture failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}
