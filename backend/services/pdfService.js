const fs = require('fs');
const path = require('path');

let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.warn('[PDF] puppeteer not installed; PDF exports will use placeholder output.');
}

class PDFService {
  constructor() {
    this.browser = null;
  }

  async initializeBrowser() {
    if (!puppeteer) {
      throw new Error('Puppeteer is unavailable in this environment.');
    }
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath: '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generatePDFReport(data, reportType, options = {}) {
    if (!puppeteer) {
      const placeholder = [
        'PDF generation disabled in this environment.',
        `Report: ${reportType}`,
        `Generated: ${new Date().toISOString()}`,
        `Records: ${data?.records?.length || 0}`,
      ].join('\n');
      return Buffer.from(placeholder, 'utf-8');
    }

    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    try {
      const templatePath = path.join(__dirname, '../templates/pdf-template.html');
      let template = fs.readFileSync(templatePath, 'utf-8');

      // Inject data into template
      template = template
        .replace(/{{reportType}}/g, reportType)
        .replace(/{{date}}/g, new Date().toLocaleString())
        .replace(/{{recordCount}}/g, data.records?.length || 0);

      await page.setContent(template, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        margin: options.margin || {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      });

      await page.close();
      return pdfBuffer;
    } finally {
      if (!options.keepBrowserOpen) {
        await this.closeBrowser();
      }
    }
  }
}

module.exports = new PDFService();
