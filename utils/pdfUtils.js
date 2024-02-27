import puppeteer from 'puppeteer';

async function genererFacturePDF(factureHTML, outputPath) {
    console.log('start puppeteer');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(factureHTML, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPath, format: 'A4' });
    await browser.close();
}

export { genererFacturePDF };