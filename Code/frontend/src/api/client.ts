import type {
  AskResponse,
  CurrentPaperResponse,
  DeletePaperResponse,
  FastApiError,
  PipelineInfo,
  UploadResponse,
  ValidationErrorItem,
} from "@/types";

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function messageFromDetail(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") {
    return typeof body === "string" && body.trim() ? body : fallback;
  }
  const detail = (body as FastApiError).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as ValidationErrorItem[])
      .map((e) => {
        const field = e.loc?.[e.loc.length - 1];
        return field ? `${field}: ${e.msg}` : e.msg;
      })
      .join("; ");
  }
  return fallback;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await parseBody(res);

    const isGatewayDown =
      res.status === 502 || res.status === 503 || res.status === 504;
    const fallback = isGatewayDown
      ? NETWORK_HINT
      : `Request failed (HTTP ${res.status})`;
    throw new ApiError(res.status, messageFromDetail(body, fallback), body);
  }
  return (await res.json()) as T;
}

const NETWORK_HINT =
  "Could not reach the backend. Is the API server running on http://localhost:8000?";

export async function getCurrentPaper(): Promise<CurrentPaperResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/paper/current`);
  } catch {
    throw new ApiError(0, NETWORK_HINT);
  }
  return handle<CurrentPaperResponse>(res);
}

export async function deletePaper(): Promise<DeletePaperResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/paper`, { method: "DELETE" });
  } catch {
    throw new ApiError(0, NETWORK_HINT);
  }
  return handle<DeletePaperResponse>(res);
}

export function uploadPdf(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResponse);
        } catch {
          reject(new ApiError(xhr.status, "Malformed response from server."));
        }
        return;
      }
      let body: unknown = xhr.responseText;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
      }
      reject(
        new ApiError(
          xhr.status,
          messageFromDetail(body, `Upload failed (HTTP ${xhr.status})`),
          body,
        ),
      );
    };

    xhr.onerror = () => reject(new ApiError(0, NETWORK_HINT));
    xhr.ontimeout = () => reject(new ApiError(0, "Upload timed out."));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export async function getPipelines(): Promise<PipelineInfo[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/pipelines`);
  } catch {
    throw new ApiError(0, NETWORK_HINT);
  }
  return handle<PipelineInfo[]>(res);
}

export async function ask(
  question: string,
  pipelineIds: string[] | null,
): Promise<AskResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, pipeline_ids: pipelineIds }),
    });
  } catch {
    throw new ApiError(0, NETWORK_HINT);
  }
  return handle<AskResponse>(res);
}
