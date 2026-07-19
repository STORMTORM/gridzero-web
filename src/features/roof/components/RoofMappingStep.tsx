import { useState } from "react";
import { Trash2, Pen, ChevronUp, ChevronDown } from "lucide-react";
import type { RoofData } from "../../shared/types";

interface RoofMappingStepProps {
	roofs: RoofData[];
	selectedRoofId: string | null;
	setSelectedRoofId: (id: string | null) => void;
	isDrawing: boolean;
	setIsDrawing: (drawing: boolean) => void;
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
	cancelDrawing,
	deleteSelectedRoof,
	updateSelectedRoof,
	onContinue,
}: RoofMappingStepProps) {

	const selectedRoof = roofs.find((r) => r.id === selectedRoofId);
	const [expandedEdgeIdx, setExpandedEdgeIdx] = useState<number | null>(null);

	const edges = selectedRoof?.parapetEdges || selectedRoof?.points.map(() => ({
		enabled: true,
		height: selectedRoof.parapetHeight,
		thickness: selectedRoof.parapetThickness,
		setback: selectedRoof.parapetSetback,
	})) || [];

	return (
		<div className="flex flex-col h-full justify-between overflow-hidden">
			<div className="flex flex-col gap-6 flex-grow overflow-y-auto scrollbar-none pr-1 pb-4">
				{/* Title Info */}
				<div>
					<h3 className="text-xl font-bold text-text flex items-center gap-2">
						<span>Roof Layout Settings</span>
					</h3>
				</div>

				{/* Drawing toggle buttons */}
				<div className="flex gap-2">
					{!isDrawing ? (
						<button
							onClick={() => {
								setIsDrawing(true);
								setSelectedRoofId(null);
							}}
							className="flex-1 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
						>
							<Pen className="w-3.5 h-3.5" />
							<span>Add Roof</span>
						</button>
					) : (
						<div className="flex-1 flex gap-2">
							<button
								onClick={cancelDrawing}
								className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 text-xs font-bold rounded-xl border border-rose-500/15 transition-all cursor-pointer"
							>
								Cancel
							</button>
						</div>
					)}
				</div>

				{/* List of roofs */}
				<div className="flex flex-col gap-2.5">
					<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Roofs Layout ({roofs.length})</span>
					{roofs.length === 0 ? (
						<div className="border border-dashed border-border rounded-2xl p-6 text-center text-xs text-placeholder">
							No roofs drawn yet. Click "Draw Roof" to outline structural zones on the map.
						</div>
					) : (
						<div className="flex flex-col gap-2 h-52 overflow-y-auto scrollbar-none bg-card p-2 border rounded-xl border-border">
							{roofs.map((r) => {
								const isSelected = r.id === selectedRoofId;
								return (
									<div
										key={r.id}
										onClick={() => setSelectedRoofId(r.id)}
										className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
											isSelected
												? "bg-primary/10 border-primary text-primary"
												: "bg-card border-border/50 text-placeholder hover:border-border hover:text-text"
										}`}
									>
										<div className="flex flex-col gap-0.5">
											<span className="text-xs font-bold">{r.name}</span>
											<span className="text-[10px] text-neutral-500">Area: {r.area.toFixed(1)} m² · Height: {r.height}m</span>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Selected Roof attributes form */}
				{selectedRoof && (
					<div className="border-t border-border pt-5 flex flex-col gap-5 bg-transparent animate-in slide-in-from-bottom duration-250">
						<div className="flex justify-between items-center">
							<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Roof Parameters</span>
						</div>

						{/* Name field with Delete button */}
						<div className="flex flex-col gap-1.5">
							<label className="text-[11px] font-semibold text-placeholder">Roof Name</label>
							<div className="flex gap-2">
								<input
									type="text"
									value={selectedRoof.name}
									onChange={(e) => updateSelectedRoof({ name: e.target.value })}
									className="flex-grow min-w-0 bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text focus:outline-none focus:border-primary transition-colors"
								/>
								<button
									onClick={deleteSelectedRoof}
									className="p-2 border border-border hover:bg-rose-500/10 text-placeholder hover:text-rose-455 rounded-xl transition-colors cursor-pointer flex-shrink-0 flex items-center justify-center bg-card shadow-sm"
									title="Delete Selected Roof"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						</div>

						{/* Elevation height slider */}
						<div className="flex flex-col gap-2">
							<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
								<span>Roof Height From Ground</span>
								<span className="text-text font-bold">{selectedRoof.height}m</span>
							</div>
							<input
								type="range"
								min="1"
								max="50"
								step="0.5"
								value={selectedRoof.height}
								onChange={(e) => updateSelectedRoof({ height: parseFloat(e.target.value) })}
								className="w-full accent-primary cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
							/>
						</div>

						{/* Parapet configurations */}
						<div className="border-t border-border pt-4 flex flex-col gap-4 bg-card p-4 rounded-2xl border border-border">
							<div className="flex justify-between items-center">
								<div className="flex flex-col gap-0.5">
									<span className="text-xs font-bold">Parapet Walls</span>
								</div>
								<label className="relative inline-flex items-center cursor-pointer select-none">
									<input
										type="checkbox"
										checked={selectedRoof.parapetEnabled}
										onChange={(e) => updateSelectedRoof({ parapetEnabled: e.target.checked })}
										className="sr-only peer"
									/>
									<div className="w-9 h-5 bg-background rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-500 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-white peer-checked:bg-primary border border-border"></div>
								</label>
							</div>

							{selectedRoof.parapetEnabled && (
								<div className="flex flex-col gap-2">
									{/* Same dimensions toggle */}
									<div className="flex justify-between items-center bg-background p-3 rounded-xl border border-border/50">
										<div className="flex flex-col gap-0.5">
											<span className="text-xs font-bold">All Parapet Same Dimensions</span>
											<span className="text-[10px] text-placeholder">Apply uniform settings to all edges</span>
										</div>
										<label className="relative inline-flex items-center cursor-pointer select-none">
											<input
												type="checkbox"
												checked={selectedRoof.parapetSameDimensions ?? true}
												onChange={(e) => {
													const same = e.target.checked;
													const newEdges = edges.map(edge => ({
														...edge,
														enabled: same ? true : edge.enabled,
													}));
													updateSelectedRoof({
														parapetSameDimensions: same,
														parapetEdges: newEdges,
													});
												}}
												className="sr-only peer"
											/>
											<div className="w-9 h-5 bg-background rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-500 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-white peer-checked:bg-primary border border-border"></div>
										</label>
									</div>

									{(selectedRoof.parapetSameDimensions ?? true) ? (
										<div className="flex flex-col gap-4 p-3 border-border/50 border bg-background rounded-xl">
											{/* Wall height */}
											<h2 className="text-xs font-bold">Parapet Dimensions</h2>
											<div className="flex flex-col gap-1.5">
												<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
													<span>Wall Height</span>
													<span className="text-text font-bold">{selectedRoof.parapetHeight}m</span>
												</div>
												<input
													type="range"
													min="0.1"
													max="3.0"
													step="0.1"
													value={selectedRoof.parapetHeight}
													onChange={(e) => {
														const h = parseFloat(e.target.value);
														const newEdges = edges.map(edge => ({ ...edge, height: h }));
														updateSelectedRoof({
															parapetHeight: h,
															parapetEdges: newEdges,
														});
													}}
													className="w-full accent-primary cursor-pointer"
												/>
											</div>

											{/* Wall thickness */}
											<div className="flex flex-col gap-1.5">
												<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
													<span>Wall Width</span>
													<span className="text-text font-bold">{selectedRoof.parapetThickness}m</span>
												</div>
												<input
													type="range"
													min="0.1"
													max="2.0"
													step="0.1"
													value={selectedRoof.parapetThickness}
													onChange={(e) => {
														const t = parseFloat(e.target.value);
														const newEdges = edges.map(edge => ({ ...edge, thickness: t }));
														updateSelectedRoof({
															parapetThickness: t,
															parapetEdges: newEdges,
														});
													}}
													className="w-full accent-primary cursor-pointer"
												/>
											</div>

											{/* Wall setback */}
											<div className="flex flex-col gap-1.5">
												<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
													<span>Setback (inside roof)</span>
													<span className="text-text font-bold">{selectedRoof.parapetSetback}m</span>
												</div>
												<input
													type="range"
													min="0"
													max="5.0"
													step="0.1"
													value={selectedRoof.parapetSetback}
													onChange={(e) => {
														const s = parseFloat(e.target.value);
														const newEdges = edges.map(edge => ({ ...edge, setback: s }));
														updateSelectedRoof({
															parapetSetback: s,
															parapetEdges: newEdges,
														});
													}}
													className="w-full accent-primary cursor-pointer"
												/>
											</div>
										</div>
									) : (
										<div className="flex flex-col gap-2 scrollbar-none">
											{edges.map((edge, edgeIdx) => {
												const expanded = expandedEdgeIdx === edgeIdx;
												const p1 = selectedRoof.points[edgeIdx];
												const p2 = selectedRoof.points[(edgeIdx + 1) % selectedRoof.points.length];
												const edgeLength = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
												return (
													<div key={edgeIdx} className={`p-3 rounded-xl border transition-all ${edge.enabled ? "bg-card border-border text-text" : "bg-transparent border-border/55 opacity-55 text-placeholder"}`}>
														{/* Edge Header */}
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<input
																	type="checkbox"
																	checked={edge.enabled}
																	onChange={(e) => {
																		const newEdges = [...edges];
																		newEdges[edgeIdx] = { ...edge, enabled: e.target.checked };
																		updateSelectedRoof({ parapetEdges: newEdges });
																	}}
																	className="w-3.5 h-3.5 accent-primary cursor-pointer"
																/>
																<span className="text-xs font-bold">Edge {edgeIdx + 1}</span>
															</div>
															<div className="flex flex-row gap-2 items-center">
																<span className="text-xs pl-2 text-placeholder font-medium">{edgeLength.toFixed(1)}m</span>
																{edge.enabled && (
																	<button
																		onClick={() => setExpandedEdgeIdx(expanded ? null : edgeIdx)}
																		className="text-placeholder hover:text-text cursor-pointer p-0.5 rounded transition-colors hover:bg-background/80"
																		title={expanded ? "Collapse" : "Edit dimensions"}
																	>
																		{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
																	</button>
																)}
															</div>
														</div>

														{/* Edge Parameters Panel */}
														{expanded && edge.enabled && (
															<div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border animate-in slide-in-from-top-1 duration-150">
																{/* Height Slider */}
																<div className="flex flex-col gap-1">
																	<div className="flex justify-between items-center text-[10px] font-semibold text-placeholder">
																		<span>Height</span>
																		<span className="text-text font-bold">{edge.height}m</span>
																	</div>
																	<input
																		type="range"
																		min="0.1"
																		max="3.0"
																		step="0.1"
																		value={edge.height}
																		onChange={(e) => {
																			const newEdges = [...edges];
																			newEdges[edgeIdx] = { ...edge, height: parseFloat(e.target.value) };
																			updateSelectedRoof({ parapetEdges: newEdges });
																		}}
																		className="w-full accent-primary cursor-pointer"
																	/>
																</div>

																{/* Thickness Slider */}
																<div className="flex flex-col gap-1">
																	<div className="flex justify-between items-center text-[10px] font-semibold text-placeholder">
																		<span>Thickness</span>
																		<span className="text-text font-bold">{edge.thickness}m</span>
																	</div>
																	<input
																		type="range"
																		min="0.05"
																		max="1.0"
																		step="0.01"
																		value={edge.thickness}
																		onChange={(e) => {
																			const newEdges = [...edges];
																			newEdges[edgeIdx] = { ...edge, thickness: parseFloat(e.target.value) };
																			updateSelectedRoof({ parapetEdges: newEdges });
																		}}
																		className="w-full accent-primary cursor-pointer"
																	/>
																</div>

																{/* Setback Slider */}
																<div className="flex flex-col gap-1">
																	<div className="flex justify-between items-center text-[10px] font-semibold text-placeholder">
																		<span>Setback</span>
																		<span className="text-text font-bold">{edge.setback}m</span>
																	</div>
																	<input
																		type="range"
																		min="0"
																		max="5.0"
																		step="0.1"
         																value={edge.setback}
																		onChange={(e) => {
																			const newEdges = [...edges];
																			newEdges[edgeIdx] = { ...edge, setback: parseFloat(e.target.value) };
																			updateSelectedRoof({ parapetEdges: newEdges });
																		}}
																		className="w-full accent-primary cursor-pointer"
																	/>
																</div>
															</div>
														)}
													</div>
												);
											})}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Continue button */}
			<div className="border-t border-border pt-4 mt-auto flex-shrink-0">
				<button
					onClick={onContinue}
					className="w-full py-3 bg-primary hover:opacity-90 text-white text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
				>
					<span>Next</span>
				</button>
			</div>
		</div>
	);
}
