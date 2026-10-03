export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const value = await response.json();
  if (!response.ok)
    throw Error(value.error || `Request failed (${response.status})`);
  return value;
}
export const workflowService = {
  list: () => api("/workflows"),
  save: (w) => api(`/workflows/${w.id}`, { method: "PUT", body: w }),
  remove: (id) => api(`/workflows/${id}`, { method: "DELETE" }),
  run: (id, body = {}) => api(`/workflows/${id}/run`, { method: "POST", body }),
};
export const credentialService = {
  list: () => api("/credentials"),
  create: (body) => api("/credentials", { method: "POST", body }),
  remove: (id) => api(`/credentials/${id}`, { method: "DELETE" }),
};
export const executionService = { list: () => api("/executions") };
