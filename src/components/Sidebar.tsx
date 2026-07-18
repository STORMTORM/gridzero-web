import { LayoutDashboard, Plus, LogOut } from "lucide-react";
import { clearTokens } from "../api/client";

interface SidebarProps {
	activeTab?: string;
	onTabChange?: (tab: string) => void;
	onNewProjectClick?: () => void;
}

export default function Sidebar({
	activeTab = "dashboard",
	onTabChange,
	onNewProjectClick,
}: SidebarProps) {
	const navItems = [
		{
			id: "dashboard",
			label: "Dashboard",
			icon: (
				<LayoutDashboard className="w-5 h-5" />
			),
		},
	];

	return (
		<div className="h-screen bg-background text-text flex flex-col justify-between p-5 border-r border-border font-sans select-none flex-shrink-0">
			{/* Top Section */}
			<div className="flex flex-col gap-8">
				{/* Logo */}
				<div className="flex items-center px-1 py-2">
					<img src="/light-header.png" alt="GridZero Logo" className="h-10 object-contain" />
					<img src="/gridzero-text.png" alt="GridZero Logo" className="h-8 object-contain self-end" />
				</div>

				<button
					onClick={onNewProjectClick}
					className="bg-primary hover:opacity-90 text-white text-base font-bold px-8 py-3 rounded-xl transition-all duration-200 flex flex-row gap-2 items-center justify-center cursor-pointer shadow"
				>
					<Plus className="w-5 h-5 text-white" />
					<span>New Project</span>
				</button>

				{/* Navigation List */}
				<nav className="flex flex-col gap-1.5">
					{navItems.map((item) => {
						const isActive = activeTab === item.id;
						return (
							<button
								key={item.id}
								onClick={() => onTabChange?.(item.id)}
								className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 relative text-left border ${
									isActive
										? "text-primary bg-primary/10 border-primary/20"
										: "text-placeholder hover:text-text hover:bg-card border-transparent"
								}`}
							>
								{/* Icon wrapper to match colors */}
								<div
									className={`transition-colors duration-200 ${isActive ? "text-primary" : "text-placeholder group-hover:text-text"}`}
								>
									{item.icon}
								</div>
								<span>{item.label}</span>

								{/* Right border indicator for active state */}
								{isActive && (
									<div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-primary rounded-l" />
								)}
							</button>
						);
					})}
				</nav>
			</div>

			{/* Bottom Section - User Profile (Dynamic with Logout) */}
			<div className="flex items-center gap-2.5 border-t border-border pt-4 px-1 flex-shrink-0">
				<div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase flex-shrink-0">
					{((localStorage.getItem("first_name") || "")[0] || "") + ((localStorage.getItem("last_name") || "")[0] || "") || "SP"}
				</div>
				<div className="flex flex-col overflow-hidden max-w-[100px]">
					<span className="text-xs font-semibold text-text truncate leading-tight">
						{`${localStorage.getItem("first_name") || ""} ${localStorage.getItem("last_name") || ""}`.trim() || "Sales Partner"}
					</span>
					<span className="text-[10px] text-placeholder font-semibold truncate mt-0.5">
						Salesman
					</span>
				</div>
				
				<button 
					onClick={() => {
						clearTokens();
						window.location.href = "/login";
					}}
					title="Log Out"
					className="ml-auto p-1.5 rounded-lg text-placeholder hover:text-error hover:bg-card border border-transparent transition-all cursor-pointer flex-shrink-0"
				>
					<LogOut className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}
