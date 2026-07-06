import { PenTool, Check, Trash2, Undo } from "lucide-react";

export interface RoofData {
	id: string;
	name: string;
	height: number;
	points: [number, number][]; // in meters [x, y]
	area: number;
	parapetEnabled: boolean;
	parapetHeight: number;
	parapetThickness: number;
	parapetSetback: number;
}

interface RoofMappingStepProps {
	roofs: RoofData[];
	selectedRoofId: string | null;
	setSelectedRoofId: (id: string | null) => void;
	isDrawing: boolean;
	setIsDrawing: (drawing: boolean) => void;
	currentPoints: [number, number][];
	undoLastPoint: () => void;
	cancelDrawing: () => void;
	deleteSelectedRoof: () => void;
	updateSelectedRoof: (updates: Partial<RoofData>) => void;
	onContinue: () => void;
}

export default function RoofMappingStep({
	roofs,
	selectedRoofId,
	setSelectedRoofId,
	isDrawing,
	setIsDrawing,
	currentPoints,
	undoLastPoint,
	cancelDrawing,
	deleteSelectedRoof,
	updateSelectedRoof,
	onContinue,
}: RoofMappingStepProps) {

	const selectedRoof = roofs.find((r) => r.id === selectedRoofId);

	return (
		<div className="h-full flex flex-col justify-between">
			<div className="flex flex-col gap-6">
				{/* Title Info */}
				<div>
					<h3 className="text-sm font-bold text-white flex items-center gap-2">
						<span>2D Design Controls</span>
					</h3>
					<p className="text-[11px] text-neutral-500 font-medium mt-1">
						Map out boundaries and setup structural parapet options.
					</p>
				</div>

				{/* Drawing toggle buttons */}
				<div className="flex gap-2">
					{!isDrawing ? (
						<button
							onClick={() => {
								setIsDrawing(true);
								setSelectedRoofId(null);
							}}
							className="flex-1 py-2.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
						>
							<PenTool className="w-3.5 h-3.5" />
							<span>Draw Roof</span>
						</button>
					) : (
						<div className="flex-1 flex gap-2">
							<button
								onClick={undoLastPoint}
								disabled={currentPoints.length === 0}
								className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent text-neutral-200 text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
								title="Undo Last Point"
							>
								<Undo className="w-3.5 h-3.5" />
								<span>Undo</span>
							</button>
							<button
								onClick={cancelDrawing}
								className="flex-1 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 text-xs font-bold rounded-xl border border-rose-500/15 transition-all cursor-pointer"
							>
								Cancel
							</button>
						</div>
					)}
				</div>

				{/* List of roofs */}
				<div className="flex flex-col gap-2.5">
					<span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Roofs Layout ({roofs.length})</span>
					{roofs.length === 0 ? (
						<div className="border border-dashed border-white/10 rounded-2xl p-6 text-center text-xs text-neutral-500">
							No roofs drawn yet. Click "Draw Roof" to outline structural zones on the map.
						</div>
					) : (
						<div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
							{roofs.map((r) => {
								const isSelected = r.id === selectedRoofId;
								return (
									<div
										key={r.id}
										onClick={() => setSelectedRoofId(r.id)}
										className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
											isSelected
												? "bg-white/10 border-white text-white"
												: "bg-white/5 border-white/5 text-neutral-400 hover:border-white/10 hover:text-white"
										}`}
									>
										<div className="flex flex-col gap-0.5">
											<span className="text-xs font-bold">{r.name}</span>
											<span className="text-[10px] text-neutral-500">Area: {r.area.toFixed(1)} m² · Height: {r.height}m</span>
										</div>
										{isSelected && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Selected Roof attributes form */}
				{selectedRoof && (
					<div className="border-t border-white/10 pt-5 flex flex-col gap-5 bg-transparent animate-in slide-in-from-bottom duration-250">
						<div className="flex justify-between items-center">
							<span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Roof Parameters</span>
							<button
								onClick={deleteSelectedRoof}
								className="p-1 hover:bg-rose-500/10 text-neutral-500 hover:text-rose-455 rounded-lg transition-colors cursor-pointer"
								title="Delete Selected Roof"
							>
								<Trash2 className="w-4 h-4" />
							</button>
						</div>

						{/* Name field */}
						<div className="flex flex-col gap-1.5">
							<label className="text-[11px] font-semibold text-neutral-400">Roof Name</label>
							<input
								type="text"
								value={selectedRoof.name}
								onChange={(e) => updateSelectedRoof({ name: e.target.value })}
								className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-white transition-colors"
							/>
						</div>

						{/* Elevation height slider */}
						<div className="flex flex-col gap-2">
							<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
								<span>Elevation / Height</span>
								<span className="text-white font-bold">{selectedRoof.height}m</span>
							</div>
							<input
								type="range"
								min="1"
								max="20"
								step="0.5"
								value={selectedRoof.height}
								onChange={(e) => updateSelectedRoof({ height: parseFloat(e.target.value) })}
								className="w-full accent-white cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
							/>
						</div>

						{/* Parapet configurations */}
						<div className="border-t border-white/5 pt-4 flex flex-col gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
							<div className="flex justify-between items-center">
								<div className="flex flex-col gap-0.5">
									<span className="text-xs font-bold">Parapet Wall</span>
									<span className="text-[10px] text-neutral-500">Enable protective parapet edge boundary</span>
								</div>
								<label className="relative inline-flex items-center cursor-pointer select-none">
									<input
										type="checkbox"
										checked={selectedRoof.parapetEnabled}
										onChange={(e) => updateSelectedRoof({ parapetEnabled: e.target.checked })}
										className="sr-only peer"
									/>
									<div className="w-9 h-5 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-500 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-white peer-checked:bg-white/20 border border-white/10"></div>
								</label>
							</div>

							{selectedRoof.parapetEnabled && (
								<div className="flex flex-col gap-4 pt-2">
									{/* Wall height */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Wall Height</span>
											<span className="text-white font-bold">{selectedRoof.parapetHeight}m</span>
										</div>
										<input
											type="range"
											min="0.3"
											max="2.5"
											step="0.1"
											value={selectedRoof.parapetHeight}
											onChange={(e) => updateSelectedRoof({ parapetHeight: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>

									{/* Wall thickness */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Wall Thickness</span>
											<span className="text-white font-bold">{selectedRoof.parapetThickness}m</span>
										</div>
										<input
											type="range"
											min="0.1"
											max="0.6"
											step="0.01"
											value={selectedRoof.parapetThickness}
											onChange={(e) => updateSelectedRoof({ parapetThickness: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>

									{/* Wall setback */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Setback (inside edge)</span>
											<span className="text-white font-bold">{selectedRoof.parapetSetback}m</span>
										</div>
										<p className="text-[9px] text-neutral-500 leading-normal">
											Setback defines a safety buffer boundary distance inside the roof edge where solar panel layouts are restricted.
										</p>
										<input
											type="range"
											min="0"
											max="2"
											step="0.1"
											value={selectedRoof.parapetSetback}
											onChange={(e) => updateSelectedRoof({ parapetSetback: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Continue button */}
			<div className="border-t border-white/10 pt-4">
				<button
					onClick={onContinue}
					className="w-full py-3 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
				>
					<Check className="w-4 h-4" />
					<span>Save & Continue</span>
				</button>
			</div>
		</div>
	);
}
