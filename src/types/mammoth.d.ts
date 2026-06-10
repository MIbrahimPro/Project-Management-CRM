declare module "mammoth" {
  interface ExtractOptions {
    buffer?: Buffer;
    path?: string;
  }

  interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string; error?: Error }>;
  }

  export function extractRawText(options: ExtractOptions): Promise<ExtractResult>;
}
