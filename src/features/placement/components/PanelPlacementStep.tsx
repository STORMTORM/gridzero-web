import { Trash2, Layers, HardDrive, Grid3X3 } from "lucide-react";
import type { PanelGroup, PanelSpec } from "../../../utils/design/types";

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
	updateSelectedGroup: (updates: Partial<PanelGroup>) => void;
	onContinue: () => void;
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
	updateSelectedGroup,
	onContinue,
}: PanelPlacementStepProps) {
	const limitReached = remainingPanelSlots !== Infinity && remainingPanelSlots <= 0;
	const canContinue = !!panelSpec && placedPanelCount > 0 && (!targetPanelCount || placedPanelCount >= targetPanelCount);

	return (
		<div className="h-full flex flex-col justify-between">
			<div className="flex flex-col gap-5 font-sans">
				
				{/* Title */}
				<div>
					<h3 className="text-sm font-bold text-white flex items-center gap-2">
						<Layers className="w-4 h-4 text-neutral-400" />
						<span>2D Panel Placement</span>
					</h3>
					<p className="text-[11px] text-neutral-500 font-medium mt-1">
						Place solar structures, define rows/columns, and set orientations.
					</p>
				</div>

				{/* Target vs placed panel counts */}
				<div className="bg-neutral-950/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 text-xs">
					<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Target vs Placed Modules</span>
					<div className="flex justify-between items-center mt-1">
						<span className="text-neutral-400">Target Count:</span>
						<span className="text-sm font-bold text-white">{targetPanelCount || 0} Panels</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-neutral-400">Placed Count:</span>
						<span className={`text-sm font-bold ${placedPanelCount >= targetPanelCount ? "text-emerald-400" : "text-amber-400"}`}>
							{placedPanelCount} Panels
						</span>
					</div>
					<div className="h-1.5 bg-black/40 rounded-full overflow-hidden mt-2">
						<div
							className="h-full bg-white rounded-full transition-all"
							style={{ width: `${targetPanelCount ? Math.min(100, (placedPanelCount / targetPanelCount) * 100) : 0}%` }}
						/>
					</div>
					<div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
						<span>Remaining</span>
						<span>{remainingPanelSlots === Infinity ? "Open" : `${remainingPanelSlots} Panels`}</span>
					</div>
				</div>

				{/* Table Configuration & Placement controls */}
				<div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
					<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Add Structure Table</span>
					{!isPlacingGroup ? (
						<button
							onClick={openAddConfigModal}
							disabled={limitReached}
							className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
						>
							<Grid3X3 className="w-3.5 h-3.5" />
							<span>Configure Grid Layout</span>
						</button>
					) : (
						<div className="flex flex-col gap-2">
							<div className="text-[10px] text-teal-400 font-bold bg-teal-500/10 border border-teal-500/15 rounded-xl px-3 py-2 text-center animate-pulse">
								Tapping roof to place table...
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
					<div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
						<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Table Configuration</span>

						{/* Edit layout grid */}
						<button
							type="button"
							onClick={openEditConfigModal}
							className="w-full py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/15 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
						>
							<Layers className="w-3.5 h-3.5" />
							<span>Configure Grid & Cells</span>
						</button>

						{/* Rotation Azimuth angle slider */}
						<div className="flex flex-col gap-2">
							<div className="flex justify-between items-center text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
								<span>Table Angle</span>
								<span className="text-white font-bold text-[10px]">{selectedGroup.table_angle || 0}°</span>
							</div>
							<input
								type="range"
								min="0"
								max="360"
								step="1"
								value={selectedGroup.table_angle || 0}
								onChange={(e) => updateSelectedGroup({ table_angle: parseInt(e.target.value) || 0 })}
								className="w-full accent-white cursor-pointer"
							/>
						</div>

						{/* Tilt and Pillars */}
						<div className="grid grid-cols-2 gap-3">
							<label className="flex flex-col gap-1.5">
								<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Tilt Angle</span>
								<input
									type="number"
									min="0"
									max="45"
									value={selectedGroup.tilt_angle ?? 0}
									onChange={(e) => updateSelectedGroup({ tilt_angle: Math.max(0, Math.min(45, parseInt(e.target.value) || 0)) })}
									className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 w-full font-bold"
								/>
							</label>
							<label className="flex flex-col gap-1.5">
								<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Pillars</span>
								<select
									value={selectedGroup.pillar_count ?? 2}
									onChange={(e) => updateSelectedGroup({ pillar_count: parseInt(e.target.value) || 2 })}
									className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 w-full font-bold font-sans"
								>
									<option value={2}>2 Pillar</option>
									<option value={3}>3 Pillar</option>
								</select>
							</label>
						</div>

						{/* Advanced Settings Accordion */}
						<details className="group/details border-t border-white/5 pt-3">
							<summary className="flex justify-between items-center text-[10px] font-bold text-neutral-400 cursor-pointer select-none uppercase tracking-wider hover:text-white transition-colors list-none">
								<span>Advanced Settings</span>
								<span className="text-xs transition-transform group-open/details:rotate-180">▼</span>
							</summary>
							<div className="flex flex-col gap-3 mt-3 animate-in fade-in duration-200">
								{/* Front & Back Pillar Heights */}
								<div className="grid grid-cols-2 gap-3">
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Front Pillar (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.front_pillar_height ?? 1.22}
											onChange={(e) => updateSelectedGroup({ front_pillar_height: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Back Pillar (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.back_pillar_height ?? 2.13}
											onChange={(e) => updateSelectedGroup({ back_pillar_height: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
								</div>

								{/* Row Gap & Col Gap */}
								<div className="grid grid-cols-2 gap-3">
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Row Gap N-S (m)</span>
										<input
											type="number"
											step="0.1"
											value={selectedGroup.row_gap ?? 1.6}
											onChange={(e) => updateSelectedGroup({ row_gap: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Col Gap E-W (m)</span>
										<input
											type="number"
											step="0.1"
											value={selectedGroup.col_gap ?? 0}
											onChange={(e) => updateSelectedGroup({ col_gap: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
								</div>

								{/* Rafter & Purlin Overhangs */}
								<div className="grid grid-cols-2 gap-3">
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Rafter Overhang (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.rafter_overhang ?? 0.1}
											onChange={(e) => updateSelectedGroup({ rafter_overhang: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Purlin Overhang (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.purlin_overhang ?? 0.1}
											onChange={(e) => updateSelectedGroup({ purlin_overhang: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
								</div>

								{/* Concrete Base Dimensions */}
								<div className="grid grid-cols-3 gap-2">
									<label className="flex flex-col gap-1">
										<span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Base H (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.base_height ?? 0.3}
											onChange={(e) => updateSelectedGroup({ base_height: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Base L (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.base_length ?? 0.3}
											onChange={(e) => updateSelectedGroup({ base_length: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
									<label className="flex flex-col gap-1">
										<span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Base W (m)</span>
										<input
											type="number"
											step="0.01"
											value={selectedGroup.base_width ?? 0.3}
											onChange={(e) => updateSelectedGroup({ base_width: parseFloat(e.target.value) || 0 })}
											className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-white/20 w-full"
										/>
									</label>
								</div>
							</div>
						</details>

						{/* Delete Structure table */}
						<button
							onClick={deleteSelectedGroup}
							className="w-full mt-2 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 text-xs font-bold rounded-xl border border-rose-500/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
						>
							<Trash2 className="w-3.5 h-3.5" />
							<span>Delete Structure</span>
						</button>
					</div>
				) : (
					<div className="border border-dashed border-white/10 rounded-2xl p-6 text-center text-xs text-neutral-500">
						No structure selected. Tap an action above to place tables, or select a table on the roof to edit.
					</div>
				)}

			</div>

			{/* Continue button */}
			<div className="flex-shrink-0 pt-4 border-t border-white/5">
				<button
					onClick={onContinue}
					disabled={!canContinue}
					className="w-full py-3 bg-white hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed text-black text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
				>
					Save and Continue
				</button>
			</div>
		</div>
	);
}
