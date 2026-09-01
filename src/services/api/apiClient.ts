async function request<T>(url: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  get: <T>(url: string, token?: string | null) => request<T>(url, { method: 'GET' }, token),
  post: <T>(url: string, body?: any, token?: string | null) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }, token),
  put: <T>(url: string, body?: any, token?: string | null) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }, token),
  delete: <T>(url: string, token?: string | null) => request<T>(url, { method: 'DELETE' }, token),
};
