/**
 * Configuration for thumbnail generation
 */
export interface ThumbnailConfig {
  width: number;
  height: number;
  quality: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top';
}

/**
 * Generic thumbnail generator interface
 */
export interface ThumbnailGenerator {
  /**
   * Generate a thumbnail from an image buffer
   * @param imageBuffer - The source image buffer
   * @param config - Thumbnail configuration
   * @returns Promise resolving to the thumbnail buffer
   */
  generateFromImage(imageBuffer: Buffer, config: ThumbnailConfig): Promise<Buffer>;

  /**
   * Generate a placeholder thumbnail for videos
   * @param config - Thumbnail configuration
   * @returns Promise resolving to the placeholder thumbnail buffer
   */
  generateVideoPlaceholder(config: ThumbnailConfig): Promise<Buffer>;
}