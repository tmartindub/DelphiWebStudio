import type { IncomingMessage, ServerResponse } from 'node:http'

// The optional serverless handlers use only these HTTP platform extensions.
// Types are erased at build time; no Vercel CLI or development server is shipped.
export interface ApiRequest extends IncomingMessage {
  body?: Record<string, unknown>
  query: Record<string, string | string[] | undefined>
}
export interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse
  json(body: unknown): ApiResponse
}
