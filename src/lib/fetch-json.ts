export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

export async function fetchJsonData<T>(url: string): Promise<{ data: T }> {
  return fetchJson<{ data: T }>(url);
}
