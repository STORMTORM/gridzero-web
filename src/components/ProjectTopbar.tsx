import { useNavigate } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";

interface ProjectTopbarProps {
	projectName: string;
	currentStage: number; // 1 to 8
	savingStatus?: string;
	activeWorkspaceTab?: "2d" | "3d";
	onWorkspaceTabChange?: (tab: "2d" | "3d") => void;
}

const STAGE_BREADCRUMBS: Record<number, string> = {
	1: "Customer Details",
	2: "Roof Mapping",
	3: "Obstruction Mapping",
	4: "Panel Selection",
	5: "Panel Placement",
	6: "Stringing",
	7: "SLD",
	8: "Proposal",
};

export default function ProjectTopbar({
	projectName,
	currentStage,
	activeWorkspaceTab,
	onWorkspaceTabChange,
}: ProjectTopbarProps) {
	const navigate = useNavigate();

	return (
		<div className="bg-black border-b border-white/10 px-6 py-4 flex-shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4 z-10 select-none">
			
			{/* Breadcrumbs Left */}
			<div className="flex items-center gap-3">
				<button
					onClick={() => navigate("/")}
					className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0"
					title="Back to Dashboard"
				>
					<ArrowLeft className="w-4.5 h-4.5" />
				</button>
				<div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-neutral-400">
					<span className="text-neutral-500">Workspace</span>
					
					<ChevronRight className="w-3 h-3 text-neutral-600" />
					<span className="font-bold text-white max-w-[120px] truncate">{projectName || "New Project"}</span>
					
					{/* Dynamically build the breadcrumb trail up to the current stage */}
					{Array.from({ length: currentStage }).map((_, idx) => {
						const stageNum = idx + 1;
						const label = STAGE_BREADCRUMBS[stageNum] || "";
						if (!label) return null;
						
						const isActive = stageNum === currentStage;
						
						return (
							<span key={stageNum} className="flex items-center gap-2.5">
								<ChevronRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
								<span className={`font-bold transition-all ${
									isActive 
										? "text-white bg-white/10 px-2.5 py-0.5 rounded border border-white/10 uppercase tracking-wider text-[10px]" 
										: "text-neutral-500"
								}`}>
									{label}
								</span>
							</span>
						);
					})}
				</div>
			</div>

			{/* Tab Selector (Renders only if in design mode and handler is provided) */}
			{currentStage >= 2 && currentStage <= 7 && activeWorkspaceTab && onWorkspaceTabChange && (
				<div className="flex bg-neutral-900 border border-white/10 rounded-xl p-0.5 flex-shrink-0 self-start xl:self-auto">
					<button
						onClick={() => onWorkspaceTabChange("2d")}
						className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
							activeWorkspaceTab === "2d" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
						}`}
					>
						2D Drawing Canvas
					</button>
					<button
						onClick={() => onWorkspaceTabChange("3d")}
						className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
							activeWorkspaceTab === "3d" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
						}`}
					>
						3D Live Preview
					</button>
				</div>
			)}
		</div>
	);
}
