import sharp from 'sharp';

/**
 * Local image checks that run before (and without) the AI model:
 * too dark, too bright, blurry or very small photos are flagged so the
 * engineer can retake them on site.
 */
export async function imageQualityWarnings(jpeg: Buffer): Promise<string[]> {
  const warnings: string[] = [];
  try {
    const img = sharp(jpeg);
    const meta = await img.metadata();
    if ((meta.width ?? 0) < 640 || (meta.height ?? 0) < 480) warnings.push('Low resolution');

    const gray = img.clone().greyscale().resize({ width: 512, height: 512, fit: 'inside' });
    const stats = await gray.clone().stats();
    const mean = stats.channels[0].mean;
    if (mean < 40) warnings.push('Too dark');
    if (mean > 235) warnings.push('Overexposed');

    // Sharpness: variance of the Laplacian (edges). Low values mean a blurry photo.
    const lap = await gray
      .clone()
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
      .stats();
    const sd = lap.channels[0].stdev;
    if (sd < 6 && stats.channels[0].stdev > 8) warnings.push('Blurry');
  } catch {
    warnings.push('Could not check image quality');
  }
  return warnings;
}
