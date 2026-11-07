export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const issue = data?.issues?.[0];
    const msg = issue ? `${data.error}: ${issue.path ? issue.path + " " : ""}${issue.message}` : data?.error;
    throw new ApiError(res.status, msg ?? "Something went wrong. Try again.");
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};
