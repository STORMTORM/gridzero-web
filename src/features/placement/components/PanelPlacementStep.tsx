import { Trash2, Layers, Grid3X3, Copy } from "lucide-react";
import type { PanelGroup, PanelSpec } from "../../../utils/design/types";
import { useUnit } from "../../shared/contexts/UnitContext";

interface PanelPlacementStepProps {
	panelSpec: PanelSpec | null;
	targetPanelCount: number;
	placedPanelCount: number;
	remainingPanelSlots: number;
	selectedGroup: PanelGroup | null;
	isPlacingGroup: boolean;
	setIsPlacingGroup: (placing: boolean) => void;
	openAddConfigModal: () => void;
	openEditConfigModal: () => void;
	deleteSelectedGroup: () => void;
	duplicateSelectedGroup: () => void;
	updateSelectedGroup: (updates: Partial<PanelGroup>) => void;
	onContinue: () => void;
	pendingDuplicateGroup?: PanelGroup | null;
}

export default function PanelPlacementStep({
	panelSpec,
	targetPanelCount,
	placedPanelCount,
	remainingPanelSlots,
	selectedGroup,
	isPlacingGroup,
	setIsPlacingGroup,
	openAddConfigModal,
	openEditConfigModal,
	deleteSelectedGroup,
	duplicateSelectedGroup,
	updateSelectedGroup,
	onContinue,
	pendingDuplicateGroup,
}: PanelPlacementStepProps) {
	const { mToUnit, unitToM, unitLabel } = useUnit();
	const overLimit = targetPanelCount > 0 && placedPanelCount > targetPanelCount;
	const canContinue = !!panelSpec && placedPanelCount > 0 && !overLimit;

	return (
		<div className="flex flex-col h-full justify-between overflow-hidden">
			<div className="flex flex-col gap-5 font-sans flex-grow overflow-y-auto pr-1 pb-4">
				
				{/* Title */}
				<div>
					<h3 className="text-sm font-bold text-text flex items-center gap-2">
						<Layers className="w-4 h-4 text-placeholder" />
						<span>2D Panel Placement</span>
					</h3>
					<p className="text-[11px] text-placeholder font-medium mt-1">
						Place solar structures, define rows/columns, and set orientations.
					</p>
				</div>

				{/* Target vs placed panel counts */}
				<div className="bg-background/40 border border-border rounded-2xl p-4 flex flex-col gap-2 text-xs">
					<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Target vs Placed Modules</span>
					<div className="flex justify-between items-center mt-1">
						<span className="text-placeholder">Target Count:</span>
						<span className="text-sm font-bold text-text">{targetPanelCount || 0} Panels</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-placeholder">Placed Count:</span>
						<span className={`text-sm font-bold ${
							overLimit ? "text-red-400" : placedPanelCount >= targetPanelCount && targetPanelCount > 0 ? "text-primary" : "text-amber-400"
						}`}>
							{placedPanelCount} Panels{overLimit ? " ⚠ Over limit" : ""}
						</span>
					</div>
					<div className="h-1.5 bg-background/40 rounded-full overflow-hidden mt-2">
						<div
							className="h-full bg-primary rounded-full transition-all"
							style={{ width: `${targetPanelCount ? Math.min(100, (placedPanelCount / targetPanelCount) * 100) : 0}%` }}
						/>
					</div>
					<div className="flex justify-between items-center text-[10px] font-bold text-placeholder">
						<span>Remaining</span>
						<span>{remainingPanelSlots === Infinity ? "Open" : `${remainingPanelSlots} Panels`}</span>
					</div>
				</div>

				{/* Table Configuration & Placement controls */}
				<div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
					<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Add Structure Table</span>
					{!isPlacingGroup ? (
						<button
							onClick={openAddConfigModal}
							disabled={overLimit}
							className="w-full py-2.5 bg-primary hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
						>
							<Grid3X3 className="w-3.5 h-3.5" />
							<span>Configure Grid Layout</span>
						</button>
					) : (
						<div className="flex flex-col gap-2">
							<div className="text-[10px] text-primary font-bold bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-center animate-pulse">
								{pendingDuplicateGroup ? "Tapping roof to place duplicated table..." : "Tapping roof to place table..."}
							</div>
							<button
								onClick={() => setIsPlacingGroup(false)}
								className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 text-xs font-bold rounded-xl border border-rose-500/15 transition-all cursor-pointer"
							>
								Cancel Placement (ESC)
							</button>
						</div>
					)}
				</div>

				{/* Selected structure configurations card */}
				{selectedGroup ? (
					<div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
						<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Table Configuration</span>

						{/* Edit layout grid */}
						<button
							type="button"
							onClick={openEditConfigModal}
							className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
						>
							<Layers className="w-3.5 h-3.5" />
							<span>Configure Grid & Cells</span>
						</button>

						{/* Rotation Azimuth angle slider */}
						<div className="flex flex-col gap-2">
							<div className="flex justify-between items-center text-[9px] font-bold text-placeholder uppercase tracking-wider">
								<span>Table Angle</span>
								<span className="text-text font-bold text-[10px]">{selectedGroup.table_angle || 0}°</span>
							</div>
							<input
								type="range"
								min="0"
								max="360"
								step="1"
								value={selectedGroup.table_angle || 0}
								onChange={(e) => updateSelectedGroup({ table_angle: parseInt(e.target.value) || 0 })}
								className="w-full accent-primary cursor-pointer"
							/>
						</div>

						{/* Tilt and Pillars */}
						<div className="grid grid-cols-2 gap-3">
							<label className="flex flex-col gap-1.5">
								<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Tilt Angle</span>
								<input
									type="number"
									min="0"
									max="45"
									value={selectedGroup.tilt_angle ?? 0}
									onChange={(e) => updateSelectedGroup({ tilt_angle: Math.max(0, Math.min(45, parseInt(e.target.value) || 0)) })}
									className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-primary w-full font-bold"
								/>
							</label>
							<label className="flex flex-col gap-1.5">
								<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Pillars</span>
								<select
									value={selectedGroup.pillar_count ?? 2}
									onChange={(e) => updateSelectedGroup({ pillar_count: parseInt(e.target.value) || 2 })}
									className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-primary w-full font-bold font-sans"
								>
									<option value={2}>2 Pillar</option>
									<option value={3}>3 Pillar</option>
								</select>
							</label>
						</div>

						{/* Advanced Settings Accordion */}
						<details className="group/details border-t border-border pt-3">
							<summary className="flex justify-between items-center text-[10px] font-bold text-placeholder cursor-pointer select-none uppercase tracking-wider hover:text-text transition-colors list-none">
								<span>Advanced Settings</span>
								<span className="text-xs transition-transform group-open/details:rotate-180">▼</span>
							</summary>
							<div className="flex flex-col gap-3 mt-3 animate-in fade-in duration-200">
								{/* Front & Back Pillar Heights */}
								<div className="grid grid-cols-2 gap-3">
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Front Pillar ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.front_pillar_height != null ? Number(mToUnit(selectedGroup.front_pillar_height).toFixed(2)) : 1.22}
											onChange={(e) => updateSelectedGroup({ front_pillar_height: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Back Pillar ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.back_pillar_height != null ? Number(mToUnit(selectedGroup.back_pillar_height).toFixed(2)) : 2.13}
											onChange={(e) => updateSelectedGroup({ back_pillar_height: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
								</div>

								{/* Row Gap & Col Gap */}
								<div className="grid grid-cols-2 gap-3">
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Row Gap N-S ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.row_gap != null ? Number(mToUnit(selectedGroup.row_gap).toFixed(2)) : 1.6}
											onChange={(e) => updateSelectedGroup({ row_gap: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Col Gap E-W ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.col_gap != null ? Number(mToUnit(selectedGroup.col_gap).toFixed(2)) : 0}
											onChange={(e) => updateSelectedGroup({ col_gap: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
								</div>

								{/* Rafter & Purlin Overhangs */}
								<div className="grid grid-cols-2 gap-3">
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Rafter Overhang ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.rafter_overhang != null ? Number(mToUnit(selectedGroup.rafter_overhang).toFixed(2)) : 0.1}
											onChange={(e) => updateSelectedGroup({ rafter_overhang: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Purlin Overhang ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.purlin_overhang != null ? Number(mToUnit(selectedGroup.purlin_overhang).toFixed(2)) : 0.1}
											onChange={(e) => updateSelectedGroup({ purlin_overhang: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
								</div>

								{/* Concrete Base Dimensions */}
								<div className="grid grid-cols-3 gap-2">
									<label className="flex flex-col gap-1">
										<span className="text-[8px] font-bold text-placeholder uppercase tracking-wider">Base H ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.base_height != null ? Number(mToUnit(selectedGroup.base_height).toFixed(2)) : 0.3}
											onChange={(e) => updateSelectedGroup({ base_height: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2 py-1.5 text-[11px] text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[8px] font-bold text-placeholder uppercase tracking-wider">Base L ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.base_length != null ? Number(mToUnit(selectedGroup.base_length).toFixed(2)) : 0.3}
											onChange={(e) => updateSelectedGroup({ base_length: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2 py-1.5 text-[11px] text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[8px] font-bold text-placeholder uppercase tracking-wider">Base W ({unitLabel})</span>
										<input
											type="number"
											step="any"
											value={selectedGroup.base_width != null ? Number(mToUnit(selectedGroup.base_width).toFixed(2)) : 0.3}
											onChange={(e) => updateSelectedGroup({ base_width: unitToM(parseFloat(e.target.value)) || 0 })}
											className="bg-background border border-border rounded-xl px-2 py-1.5 text-[11px] text-text focus:outline-none focus:border-primary w-full"
										/>
									</label>
								</div>
							</div>
						</details>

						{/* Duplicate & Delete Structure table */}
						<div className="flex gap-2 mt-2">
							<button
								onClick={duplicateSelectedGroup}
								className="flex-1 py-2 bg-card hover:bg-background text-text text-xs font-bold rounded-xl border border-border transition-all flex items-center justify-center gap-1.5 cursor-pointer"
							>
								<Copy className="w-3.5 h-3.5" />
								<span>Duplicate</span>
							</button>
							<button
								onClick={deleteSelectedGroup}
								className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 text-xs font-bold rounded-xl border border-rose-500/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
							>
								<Trash2 className="w-3.5 h-3.5" />
								<span>Delete</span>
							</button>
						</div>
					</div>
				) : (
					<div className="border border-dashed border-border rounded-2xl p-6 text-center text-xs text-placeholder">
						No structure selected. Tap an action above to place tables, or select a table on the roof to edit.
					</div>
				)}

			</div>

			{/* Continue button */}
			<div className="flex-shrink-0 pt-4 border-t border-border mt-auto">
				<button
					onClick={onContinue}
					disabled={!canContinue}
					className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
				>
					Save and Continue
				</button>
			</div>
		</div>
	);
}
