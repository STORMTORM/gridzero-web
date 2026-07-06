import axios from "axios";

const API_BASE_URL = "https://backend.gridzero.in/api/v1/salesman";

export const getAccessToken = () => localStorage.getItem("access_token");
export const getRefreshToken = () => localStorage.getItem("refresh_token");

export const saveTokens = (access: string, refresh: string) => {
	localStorage.setItem("access_token", access);
	localStorage.setItem("refresh_token", refresh);
};

export const clearTokens = () => {
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
	localStorage.removeItem("first_name");
	localStorage.removeItem("last_name");
};

export const isAuthenticated = () => {
	return !!getAccessToken();
};

declare module "axios" {
	interface InternalAxiosRequestConfig {
		_retry?: boolean;
	}
}

const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 15000,
	headers: {
		"Content-Type": "application/json",
		"bypass-tunnel-reminder": "true",
		"x-devtunnels-disable-warn": "true",
	},
});

// Request Interceptor to inject the JWT Token
api.interceptors.request.use(
	(config) => {
		const token = getAccessToken();
		if (token && config.headers) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
	failedQueue.forEach((prom) => {
		if (error) {
			prom.reject(error);
		} else {
			prom.resolve(token);
		}
	});
	failedQueue = [];
};

// Response Interceptor to handle authentication expiration (401) and token refresh
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;
		if (!originalRequest) return Promise.reject(error);

		if (error.response && error.response.status === 401 && !originalRequest._retry) {
			if (isRefreshing) {
				return new Promise((resolve, reject) => {
					failedQueue.push({ resolve, reject });
				})
					.then((token) => {
						originalRequest._retry = true; // Lock retried queue items from triggering loops
						if (originalRequest.headers) {
							originalRequest.headers.Authorization = `Bearer ${token}`;
						}
						return api(originalRequest);
					})
					.catch((err) => {
						return Promise.reject(err);
					});
			}

			originalRequest._retry = true;
			isRefreshing = true;

			try {
				const refreshToken = getRefreshToken();
				if (!refreshToken) {
					clearTokens();
					processQueue(error, null);
					if (typeof window !== "undefined" && window.location.pathname !== "/login") {
						window.location.href = "/login";
					}
					return Promise.reject(error);
				}

				const res = await axios.post(
					`${API_BASE_URL}/auth/refresh-token`,
					{ refresh_token: refreshToken },
					{ timeout: 10000 }
				);

				const newAccessToken = res.data?.access_token;
				const newRefreshToken = res.data?.refresh_token;
				
				if (!newAccessToken || !newRefreshToken) {
					throw new Error("Invalid token refresh payload");
				}

				saveTokens(newAccessToken, newRefreshToken);

				if (originalRequest.headers) {
					originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
				}
				processQueue(null, newAccessToken);
				return api(originalRequest);
			} catch (err) {
				processQueue(err, null);
				clearTokens();
				if (typeof window !== "undefined" && window.location.pathname !== "/login") {
					window.location.href = "/login";
				}
				return Promise.reject(err);
			} finally {
				isRefreshing = false;
			}
		}

		return Promise.reject(error);
	}
);

export default api;
