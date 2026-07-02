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

// Response Interceptor to handle authentication expiration (401)
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		if (error.response && error.response.status === 401) {
			clearTokens();
			// Redirect to login page if we are in the browser
			if (typeof window !== "undefined" && window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	}
);

export default api;
