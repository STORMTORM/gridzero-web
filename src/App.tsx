import { useState } from "react";
import { Routes, Route, Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import CustomerDetail from "./pages/project/CustomerDetail";
import DesignWorkspace from "./pages/project/DesignWorkspace";
import EquipmentSelection from "./pages/project/EquipmentSelection";
import Pricing from "./pages/project/Pricing";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import NewProjectModal from "./components/NewProjectModal";

export default function App() {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("dashboard");
	const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

	return (
		<div className="h-screen w-screen bg-background text-text font-sans relative flex flex-col overflow-hidden">
			<Routes>
				{/* Public Login Page */}
				<Route path="/login" element={<Login />} />

				{/* Protected Routes WITH Sidebar */}
				<Route
					element={
						<ProtectedRoute>
							<div className="flex h-screen w-screen overflow-hidden bg-background">
								<Sidebar
									activeTab={activeTab}
									onTabChange={setActiveTab}
									onNewProjectClick={() => setIsNewProjectModalOpen(true)}
								/>

								<main className="flex-grow flex flex-col overflow-hidden max-w-7xl mx-auto w-full">
									<Outlet />
								</main>
							</div>
						</ProtectedRoute>
					}
				>
					{/* Protected Dashboard */}
					<Route
						path="/"
						element={
							<Dashboard
								onNewProjectClick={() => setIsNewProjectModalOpen(true)}
								onOpenProject={(project) => navigate(`/project/${project.id}/details`)}
							/>
						}
					/>
				</Route>

				{/* Protected Routes WITHOUT Sidebar */}
				<Route
					element={
						<ProtectedRoute>
							<div className="flex h-screen w-screen overflow-hidden bg-background">
								<main className="flex-1 flex flex-col overflow-hidden mx-auto w-full">
									<Outlet />
								</main>
							</div>
						</ProtectedRoute>
					}
				>
					<Route path="/project/:id/details" element={<CustomerDetail />} />
					<Route path="/project/:id/design" element={<DesignWorkspace />} />
					<Route path="/project/:id/equipment" element={<EquipmentSelection />} />
					<Route path="/project/:id/pricing" element={<Pricing />} />
				</Route>
			</Routes>

			{/* Workflow Selection Modal */}
			<NewProjectModal
				isOpen={isNewProjectModalOpen}
				onClose={() => setIsNewProjectModalOpen(false)}
			/>
		</div>
	);
}
