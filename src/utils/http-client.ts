/**
 * Generic HTTP client interface for making HTTP requests
 */
export interface HttpClient {
  /**
   * Fetch a resource and return it as a Buffer
   * @param url - The URL to fetch
   * @returns Promise resolving to a Buffer containing the response body
   */
  fetchAsBuffer(url: string): Promise<Buffer>;
}

/**
 * Default HTTP client implementation using native fetch
 */
export class FetchHttpClient implements HttpClient {
  async fetchAsBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}