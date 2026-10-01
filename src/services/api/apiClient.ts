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
    if (response.status === 401) {
      // Token is invalid or expired
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const contentType = response.headers.get('content-type') || '';
    let errorMessage = `Request to ${url} failed with status ${response.status}`;
    if (contentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({}));
      errorMessage = errorData.error || errorMessage;
    } else {
      const text = await response.text().catch(() => '');
      if (text && !text.includes('<!doctype') && !text.includes('<html')) {
        errorMessage = text;
      }
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unexpected non-JSON response from ${url} (${response.status})`);
  }
}

export const apiClient = {
  get: <T>(url: string, token?: string | null) => request<T>(url, { method: 'GET' }, token),
  post: <T>(url: string, body?: any, token?: string | null) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }, token),
  put: <T>(url: string, body?: any, token?: string | null) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }, token),
  delete: <T>(url: string, token?: string | null) => request<T>(url, { method: 'DELETE' }, token),
};
