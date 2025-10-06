import sharp from 'sharp';
import type { ThumbnailGenerator, ThumbnailConfig } from './thumbnail-generator';

/**
 * Sharp-based implementation of ThumbnailGenerator
 */
export class SharpThumbnailGenerator implements ThumbnailGenerator {
  async generateFromImage(imageBuffer: Buffer, config: ThumbnailConfig): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize(config.width, config.height, {
        fit: config.fit || 'cover',
        position: config.position || 'center'
      })
      .jpeg({ quality: config.quality })
      .toBuffer();
  }

  async generateVideoPlaceholder(config: ThumbnailConfig): Promise<Buffer> {
    return sharp({
      create: {
        width: config.width,
        height: config.height,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 }
      }
    })
      .jpeg({ quality: config.quality })
      .toBuffer();
  }
}