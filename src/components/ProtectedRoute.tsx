import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../api/client";

interface ProtectedRouteProps {
	children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
	if (!isAuthenticated()) {
		return <Navigate to="/login" replace />;
	}
	return <>{children}</>;
}
