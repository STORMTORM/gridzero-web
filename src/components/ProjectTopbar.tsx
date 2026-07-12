import { useNavigate } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";

interface ProjectTopbarProps {
	projectName: string;
	currentStage: number; // 1 to 8
	saving?: boolean;
	savingStatus?: string;
	onContinue?: () => void;
}

const STAGE_BREADCRUMBS: Record<number, string> = {
	1: "Customer Details",
	2: "Roof Mapping",
	3: "Obstruction Mapping",
	4: "Panel Selection",
	5: "Panel Placement",
	6: "Snapshots",
	7: "Pricing",
	8: "Proposal",
};

export default function ProjectTopbar({
	projectName,
	currentStage,
	saving,
	savingStatus,
	onContinue,
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

			{/* Actions Right */}
			<div className="flex items-center gap-4 self-start xl:self-auto">
				{/* Saving Indicator */}
				{(saving || savingStatus) && (
					<div className="flex items-center gap-2 px-3 py-1 bg-white-500/10 border border-white-500/20 rounded-full animate-pulse shadow-[0_0_12px_rgba(20,184,166,0.2)]">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
							<span className="relative inline-flex rounded-full h-2 w-2 bg-white-500"></span>
						</span>
						<span className="text-[10px] font-extrabold text-white uppercase tracking-widest">
							{savingStatus || "SAVING"}
						</span>
					</div>
				)}

				{/* Continue Button */}
				{onContinue && (
					<button
						onClick={onContinue}
						className="flex items-center gap-1.5 px-4 py-1.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider rounded transition-all cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.15)]"
					>
						<span>Continue</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</button>
				)}
			</div>
		</div>
	);
}
