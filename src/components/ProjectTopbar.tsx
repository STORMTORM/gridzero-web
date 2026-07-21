import { useNavigate } from "react-router-dom";
import { ChevronRight, ArrowLeft, Settings, Undo, Redo } from "lucide-react";
import { useUnit } from "../features/shared/contexts/UnitContext";

interface ProjectTopbarProps {
	projectName: string;
	currentStage: number; // 1 to 8
	saving?: boolean;
	savingStatus?: string;
	onContinue?: () => void;
	onOpenSettings?: () => void;
	undoRedo?: {
		undo: () => void;
		redo: () => void;
		canUndo: boolean;
		canRedo: boolean;
	};
}

const STAGE_BREADCRUMBS: Record<number, string> = {
	1: "Customer Details",
	2: "Roof Mapping",
	3: "Objects",
	4: "System Sizing",
	5: "2D Panel Placement",
	6: "3D Visualisation",
	7: "Pricing & Payback",
	8: "Final Checklist",
};

export default function ProjectTopbar({
	projectName,
	currentStage,
	saving,
	savingStatus,
	onContinue,
	onOpenSettings,
	undoRedo,
}: ProjectTopbarProps) {
	const navigate = useNavigate();
	const { unit, setUnit } = useUnit();

	return (
		<div className="bg-background border-b border-border px-6 py-3 flex-shrink-0 flex flex-row items-center justify-between gap-4 z-10 select-none h-14 overflow-hidden">
			
			{/* Breadcrumbs Left */}
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<button
					onClick={() => navigate("/")}
					className="text-placeholder hover:text-text p-1 rounded-lg hover:bg-background transition-colors cursor-pointer flex-shrink-0"
					title="Back to Dashboard"
				>
					<ArrowLeft className="w-4.5 h-4.5" />
				</button>
				<div className="flex items-center gap-2 text-xs font-semibold text-placeholder min-w-0 overflow-x-auto scrollbar-none flex-nowrap whitespace-nowrap">
					<span className="font-bold text-text max-w-[100px] sm:max-w-[150px] truncate flex-shrink-0">{projectName || "New Project"}</span>
					
					{/* Dynamically build the breadcrumb trail up to the current stage */}
					{Array.from({ length: currentStage }).map((_, idx) => {
						const stageNum = idx + 1;
						const label = STAGE_BREADCRUMBS[stageNum] || "";
						if (!label) return null;
						
						const isActive = stageNum === currentStage;
						
						return (
							<span key={stageNum} className="flex items-center gap-2 flex-shrink-0">
								<ChevronRight className="w-3 h-3 text-placeholder flex-shrink-0" />
								<span className={`font-bold transition-all ${
									isActive 
										? "text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20 tracking-wider text-xs flex-shrink-0" 
										: "text-placeholder flex-shrink-0"
								}`}>
									{label}
								</span>
							</span>
						);
					})}
				</div>
			</div>

			{/* Actions Right */}
			<div className="flex items-center gap-3 flex-shrink-0">
				{/* Saving Indicator */}
				{(saving || savingStatus) && (
					<div className="flex items-center gap-2 px-3 py-1 bg-white-500/10 border border-white-500/20 rounded-full animate-pulse shadow-[0_0_12px_rgba(20,184,166,0.2)]">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
							<span className="relative inline-flex rounded-full h-2 w-2 bg-white-500"></span>
						</span>
						<span className="text-[10px] font-extrabold text-text uppercase tracking-widest">
							{savingStatus || "SAVING"}
						</span>
					</div>
				)}

				{/* Undo/Redo Buttons */}
				{undoRedo && (
					<div className="flex items-center gap-4 bg-card border border-border px-2 rounded-xl flex-shrink-0 shadow-sm">
						<button
							onClick={undoRedo.undo}
							disabled={!undoRedo.canUndo}
							className="rounded-lg text-placeholder hover:text-text hover:bg-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-placeholder transition-all cursor-pointer disabled:cursor-not-allowed"
							title="Undo"
						>
							<Undo className="w-5 aspect-square" />
						</button>
						<button
							onClick={undoRedo.redo}
							disabled={!undoRedo.canRedo}
							className="rounded-lg text-placeholder hover:text-text hover:bg-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-placeholder transition-all cursor-pointer disabled:cursor-not-allowed"
							title="Redo"
						>
							<Redo className="w-5 aspect-square" />
						</button>
					</div>
				)}

				{/* Unit Toggle (m / ft) */}
				<div className="flex items-center bg-card border border-border p-0.5 rounded-xl flex-shrink-0 shadow-sm overflow-hidden">
					<button
						onClick={() => setUnit("m")}
						className={`px-2.5 py-0.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer ${
							unit === "m" ? "bg-primary text-white shadow-sm" : "text-placeholder hover:text-text"
						}`}
					>
						m
					</button>
					<button
						onClick={() => setUnit("ft")}
						className={`px-2.5 py-0.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer ${
							unit === "ft" ? "bg-primary text-white shadow-sm" : "text-placeholder hover:text-text"
						}`}
					>
						ft
					</button>
				</div>

				{/* Settings button */}
				{onOpenSettings && (
					<button
						onClick={onOpenSettings}
						className="p-1.5 rounded-lg border border-border bg-card text-placeholder hover:text-text hover:bg-background transition-all cursor-pointer flex-shrink-0"
						title="Workspace Settings"
					>
						<Settings className="w-4 h-4" />
					</button>
				)}

				{/* Continue Button */}
				{onContinue && (
					<button
						onClick={onContinue}
						className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded transition-all cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.15)]"
					>
						<span>Continue</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</button>
				)}
			</div>
		</div>
	);
}
