import { X, Columns, Square } from "lucide-react";

interface WorkspaceSettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	layoutMode: "split" | "toggle";
	setLayoutMode: (mode: "split" | "toggle") => void;
}

export default function WorkspaceSettingsModal({
	isOpen,
	onClose,
	layoutMode,
	setLayoutMode,
}: WorkspaceSettingsModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop Overlay */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
				onClick={onClose}
			/>

			{/* Modal Body Container */}
			<div className="relative w-full max-w-lg bg-background rounded-3xl border border-border overflow-hidden p-6 flex flex-col gap-5 animate-in fade-in duration-300 z-10 text-text shadow-2xl">
				
				{/* Top Bar / Header */}
				<div className="flex flex-row justify-between items-center flex-shrink-0">
					<div className="flex flex-col gap-1">
						<h2 className="text-xl font-bold text-text tracking-tight">
							Workspace Settings
						</h2>
					</div>
					
					<button
						onClick={onClose}
						className="text-placeholder hover:text-text hover:bg-card p-2 rounded-full transition-colors cursor-pointer"
						aria-label="Close settings modal"
					>
						<X className="w-4.5 h-4.5" />
					</button>
				</div>

				{/* Settings Content Area */}
				<div className="flex flex-col gap-4">
					<div className="text-xs font-bold text-placeholder uppercase tracking-wider">
						Workspace Layout
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{/* Option 1: Split View */}
						<button
							type="button"
							onClick={() => setLayoutMode("split")}
							className={`group flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
								layoutMode === "split"
									? "bg-primary/10 border-primary text-primary"
									: "bg-card border-border hover:border-primary/20 text-text"
							}`}
						>
							<div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-sm transition-colors ${
								layoutMode === "split"
									? "bg-primary/20 border-primary/20 text-primary"
									: "bg-background border-border text-placeholder group-hover:text-text"
							}`}>
								<Columns className="w-4.5 h-4.5" />
							</div>
							<div className="flex flex-col gap-0.5">
								<span className={`text-xs font-extrabold transition-colors ${
									layoutMode === "split" ? "text-primary" : "text-text"
								}`}>
									Split View
								</span>
								<span className="text-[10px] text-placeholder leading-relaxed font-semibold">
									2D canvas & 3D view side-by-side.
								</span>
							</div>
						</button>

						{/* Option 2: Single View (Toggleable) */}
						<button
							type="button"
							onClick={() => setLayoutMode("toggle")}
							className={`group flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
								layoutMode === "toggle"
									? "bg-primary/10 border-primary text-primary"
									: "bg-card border-border hover:border-primary/20 text-text"
							}`}
						>
							<div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-sm transition-colors ${
								layoutMode === "toggle"
									? "bg-primary/20 border-primary/20 text-primary"
									: "bg-background border-border text-placeholder group-hover:text-text"
							}`}>
								<Square className="w-4.5 h-4.5" />
							</div>
							<div className="flex flex-col gap-0.5">
								<span className={`text-xs font-extrabold transition-colors ${
									layoutMode === "toggle" ? "text-primary" : "text-text"
								}`}>
									Single View
								</span>
								<span className="text-[10px] text-placeholder leading-relaxed font-semibold">
									Toggle between 2D canvas & 3D view.
								</span>
							</div>
						</button>
					</div>
				</div>

				{/* Close/Apply Footer Button */}
				<button
					type="button"
					onClick={onClose}
					className="w-full py-3 bg-primary hover:opacity-90 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center cursor-pointer border border-transparent mt-2"
				>
					Apply settings
				</button>
			</div>
		</div>
	);
}
