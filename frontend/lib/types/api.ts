export interface HealthStatus {
  status: "ok" | "degraded";
  db: "ok" | "error";
  redis: "ok" | "error";
  storage: "ok" | "error";
}

export interface AICallRequest {
  capability: string;
  inputs: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  preferred_model?: string;
}

export interface AICallResponse {
  success: boolean;
  outputs: Record<string, unknown>;
  model_used: string;
  provider: string;
  cost_usd: string;
  latency_ms: number;
  error?: string;
}
