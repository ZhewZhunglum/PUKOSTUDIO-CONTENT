import axios from "axios";
import { clearToken, getToken } from "./auth";

// Use NEXT_PUBLIC_API_URL when explicitly set (e.g. SSR internal calls).
// Otherwise default to "" (relative URL) so browser requests go to the same
// origin — nginx proxies /api/* to the backend, avoiding any CORS issue.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request if available
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      clearToken();
      window.location.href = "/login";
    }
    const message =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.message ||
      "Unknown error";
    return Promise.reject(new Error(message));
  }
);
