/**
 * PDF Export
 * 
 * Generates PDF in memory and streams it directly to the browser.
 * No cloud storage needed - zero costs, zero setup!
 */

import { chromium } from 'playwright';

export interface DirectPdfOptions {
  reportUrl: string;
  whiteLabel?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

/**
 * Generate PDF and return as Buffer (no storage)
 */
export async function generatePdfBuffer(
  options: DirectPdfOptions
): Promise<{ success: true; buffer: Buffer } | { success: false; error: string }> {
  let browser;

  try {
    // Launch headless browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewportSize({ width: 1200, height: 800 });

    // Navigate to report page
    await page.goto(options.reportUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Inject white-label customizations if provided
    if (options.whiteLabel) {
      await page.evaluate((wl) => {
        // Hide default VibeSafe branding
        const brandingElements = document.querySelectorAll('[data-brand="vibesafe"]');
        brandingElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));

        // Inject custom logo
        if (wl.logoUrl) {
          const logoEl = document.querySelector('[data-whitelabel-logo]');
          if (logoEl) {
            (logoEl as HTMLImageElement).src = wl.logoUrl;
          }
        }

        // Apply custom color
        if (wl.primaryColor) {
          document.documentElement.style.setProperty('--primary-color', wl.primaryColor);
        }

        // Replace company name
        if (wl.companyName) {
          const companyEls = document.querySelectorAll('[data-whitelabel-company]');
          companyEls.forEach((el) => {
            el.textContent = wl.companyName || '';
          });
        }
      }, options.whiteLabel);
    }

    // Generate PDF as buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();

    return {
      success: true,
      buffer: Buffer.from(pdfBuffer),
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    console.error('PDF generation failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during PDF generation',
    };
  }
}

/**
 * Check if direct PDF export is available
 * (Playwright must be installed)
 */
export function isDirectPdfAvailable(): boolean {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}
