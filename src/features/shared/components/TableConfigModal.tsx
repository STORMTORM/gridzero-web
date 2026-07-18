import { useState, useMemo, useEffect } from "react";
import { Plus, Minus, Check, ArrowLeft } from "lucide-react";
import type { PanelSpec } from "../../../utils/design/types";

interface TableConfig {
	orientation: "portrait" | "landscape";
	grid_cols: number;
	grid_rows: number;
	table_angle: number;
	tilt_angle: number;
	pillar_count: number;
	cells?: { r: number; c: number }[];
	pillars_per_structure_ew?: number;
	panels_per_structure?: number;
}

interface TableConfigModalProps {
	visible: boolean;
	onClose: () => void;
	remainingSlots: number;
	initialConfig?: TableConfig | null;
	onConfirm: (config: TableConfig) => void;
	panelSpec: PanelSpec | null;
	mode?: "add" | "edit";
}

const MAX_ROWS = 30;
const MAX_COLS = 30;
const MAX_PILLARS_EW = 12;

function getValidPanelsPerStructure(rows: number): number[] {
	const out = [];
	for (let d = 1; d <= Math.min(rows, 9); d++) {
		if (rows % d === 0) out.push(d);
	}
	return out.length ? out : [1];
}

function getValidNumStructures(rows: number): number[] {
	return getValidPanelsPerStructure(rows)
		.map((pps) => rows / pps)
		.sort((a, b) => a - b);
}

function minPanelsFor3Pillars(orientation: "portrait" | "landscape"): number {
	return orientation === "portrait" ? 3 : 4;
}

export function TableConfigModal({
	visible,
	onClose,
	remainingSlots,
	initialConfig,
	onConfirm,
	mode,
}: TableConfigModalProps) {
	const [step, setStep] = useState<"orientation" | "layout">("orientation");
	const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
	const [rows, setRows] = useState(2);
	const [cols, setCols] = useState(5);
	const [pillarCount, setPillarCount] = useState<2 | 3>(2);
	const [pillarsEW, setPillarsEW] = useState(2);
	const [panelsPerStructure, setPanelsPerStructure] = useState(2);
	const [removedCells, setRemovedCells] = useState<Set<string>>(new Set());

	// Hydrate from initial configuration if provided
	useEffect(() => {
		if (visible) {
			if (initialConfig && mode === "edit") {
				setOrientation(initialConfig.orientation || "portrait");
				setRows(initialConfig.grid_rows || 2);
				setCols(initialConfig.grid_cols || 5);
				setPillarCount((initialConfig.pillar_count as 2 | 3) || 2);
				setPillarsEW(initialConfig.pillars_per_structure_ew || 2);
				setPanelsPerStructure(initialConfig.panels_per_structure || 2);
				
				const gridCells = initialConfig.cells || [];
				const activeSet = new Set(gridCells.map((c) => `${c.r}-${c.c}`));
				const inactiveSet = new Set<string>();
				for (let r = 0; r < (initialConfig.grid_rows || 2); r++) {
					for (let c = 0; c < (initialConfig.grid_cols || 5); c++) {
						if (!activeSet.has(`${r}-${c}`)) {
							inactiveSet.add(`${r}-${c}`);
						}
					}
				}
				setRemovedCells(inactiveSet);
				setStep("layout");
			} else {
				// Default reset (add mode)
				setStep("orientation");
				setOrientation("portrait");
				setRows(2);
				setCols(5);
				setPillarCount(2);
				setPillarsEW(2);
				setPanelsPerStructure(2);
				setRemovedCells(new Set());
			}
		}
	}, [visible, initialConfig, mode]);

	// Constraints checks
	const numStructuresOptions = useMemo(() => getValidNumStructures(rows), [rows]);
	const numStructures = useMemo(() => Math.max(1, Math.round(rows / panelsPerStructure)), [rows, panelsPerStructure]);
	const allow3PillarsNS = useMemo(() => panelsPerStructure >= minPanelsFor3Pillars(orientation), [panelsPerStructure, orientation]);

	// If rows change, adjust derived values
	const handleRowsChange = (val: number) => {
		const nextRows = Math.max(1, Math.min(MAX_ROWS, val));
		setRows(nextRows);
		const validPPS = getValidPanelsPerStructure(nextRows);
		if (!validPPS.includes(panelsPerStructure)) {
			setPanelsPerStructure(validPPS[validPPS.length - 1]);
		}
		setRemovedCells(new Set());
	};

	const handleColsChange = (val: number) => {
		const nextCols = Math.max(1, Math.min(MAX_COLS, val));
		setCols(nextCols);
		setRemovedCells(new Set());
	};

	const handleNumStructuresChange = (n: number) => {
		if (n <= 0 || rows % n !== 0) return;
		setPanelsPerStructure(rows / n);
		setRemovedCells(new Set());
	};

	// Fallback check to reset middle pillar count
	useEffect(() => {
		if (pillarCount === 3 && panelsPerStructure < minPanelsFor3Pillars(orientation)) {
			setPillarCount(2);
		}
	}, [panelsPerStructure, orientation, pillarCount]);

	// Cell toggle logic
	const totalCellsCount = rows * cols;
	const activePanelsCount = totalCellsCount - removedCells.size;
	const overCapacity = remainingSlots !== Infinity && activePanelsCount > remainingSlots;

	const toggleCellActive = (r: number, c: number) => {
		const key = `${r}-${c}`;
		setRemovedCells((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				// Prevent deleting the last cell in its row (cannot empty a row completely)
				const rowCellsCount = Array.from({ length: cols }).filter((_, colIdx) => !next.has(`${r}-${colIdx}`)).length;
				if (rowCellsCount <= 1) {
					return prev; // block deletion
				}
				next.add(key);
			}
			return next;
		});
	};

	const handleConfirm = () => {
		if (overCapacity) return;
		
		const activeCells: { r: number; c: number }[] = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				if (!removedCells.has(`${r}-${c}`)) {
					activeCells.push({ r, c });
				}
			}
		}

		onConfirm({
			orientation,
			grid_rows: rows,
			grid_cols: cols,
			table_angle: initialConfig?.table_angle ?? 0,
			tilt_angle: initialConfig?.tilt_angle ?? 17,
			pillar_count: pillarCount,
			pillars_per_structure_ew: pillarsEW,
			panels_per_structure: panelsPerStructure,
			cells: activeCells.length === totalCellsCount ? undefined : activeCells,
		});
	};

	if (!visible) return null;

	return (
		<div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="bg-card border border-border w-full max-w-[500px] rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all transform animate-in zoom-in-95 duration-200">
				
				{/* Modal Header */}
				<div className="px-6 py-5 border-b border-border flex justify-between items-center bg-background/[0.02]">
					<div className="flex items-center gap-2.5">
						{step === "layout" && (
							<button 
								onClick={() => setStep("orientation")}
								className="text-placeholder hover:text-text p-1 hover:bg-background rounded-lg transition-all cursor-pointer"
							>
								<ArrowLeft className="w-4 h-4" />
							</button>
						)}
						<h3 className="text-sm font-bold text-text uppercase tracking-wider font-sans">
							{step === "orientation" ? "Panel Orientation" : "Panel Layout Setup"}
						</h3>
					</div>
					<button 
						onClick={onClose}
						className="text-placeholder hover:text-text transition-all text-xs font-semibold cursor-pointer px-2.5 py-1 hover:bg-background rounded-lg"
					>
						Cancel
					</button>
				</div>

				{/* Modal Content */}
				<div className="p-6 flex-grow flex flex-col gap-6 select-none font-sans text-text">
					
					{/* STEP 1: Orientation */}
					{step === "orientation" && (
						<div className="flex flex-col gap-5 py-6">
							<p className="text-xs text-placeholder text-center font-medium">
								Select how solar modules are oriented inside the structure.
							</p>
							<div className="grid grid-cols-2 gap-4">
								<button
									onClick={() => {
										setOrientation("portrait");
										setStep("layout");
									}}
									className="group bg-background border border-border hover:border-border p-5 rounded-2xl flex flex-col items-center gap-4 transition-all active:scale-98 cursor-pointer"
								>
									<div className="w-12 h-16 border-2 border-dashed border-placeholder group-hover:border-primary flex items-center justify-center rounded-lg bg-card transition-colors p-2.5">
										<div className="w-full h-full bg-primary/25 border border-primary rounded" />
									</div>
									<span className="text-xs font-bold text-text group-hover:text-primary transition-colors">Portrait</span>
								</button>
								<button
									onClick={() => {
										setOrientation("landscape");
										setStep("layout");
									}}
									className="group bg-background border border-border hover:border-border p-5 rounded-2xl flex flex-col items-center gap-4 transition-all active:scale-98 cursor-pointer"
								>
									<div className="w-16 h-12 border-2 border-dashed border-placeholder group-hover:border-primary flex items-center justify-center rounded-lg bg-card transition-colors p-2.5">
										<div className="w-full h-full bg-primary/25 border border-primary rounded" />
									</div>
									<span className="text-xs font-bold text-text group-hover:text-primary transition-colors">Landscape</span>
								</button>
							</div>
						</div>
					)}

					{/* STEP 2: Layout & Details */}
					{step === "layout" && (
						<div className="flex flex-col gap-5 animate-in fade-in duration-200">
							
							{/* Number of Panels Steppers */}
							<div className="flex flex-col gap-3.5">
								<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Number of Panels</span>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex flex-col gap-2">
										<span className="text-[10px] font-bold text-placeholder">North-South (Rows)</span>
										<div className="flex items-center bg-background border border-border rounded-xl overflow-hidden p-1 gap-1">
											<button
												onClick={() => handleRowsChange(rows - 1)}
												disabled={rows <= 1}
												className="p-1.5 bg-card hover:bg-background disabled:opacity-30 rounded-lg text-text cursor-pointer transition-all active:scale-90"
											>
												<Minus className="w-3.5 h-3.5" />
											</button>
											<input
												type="number"
												value={rows}
												onChange={(e) => handleRowsChange(parseInt(e.target.value) || 1)}
												className="w-full text-center bg-transparent focus:outline-none text-xs font-bold text-text"
											/>
											<button
												onClick={() => handleRowsChange(rows + 1)}
												disabled={rows >= MAX_ROWS}
												className="p-1.5 bg-card hover:bg-background disabled:opacity-30 rounded-lg text-text cursor-pointer transition-all active:scale-90"
											>
												<Plus className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
									<div className="flex flex-col gap-2">
										<span className="text-[10px] font-bold text-placeholder">East-West (Columns)</span>
										<div className="flex items-center bg-background border border-border rounded-xl overflow-hidden p-1 gap-1">
											<button
												onClick={() => handleColsChange(cols - 1)}
												disabled={cols <= 1}
												className="p-1.5 bg-card hover:bg-background disabled:opacity-30 rounded-lg text-text cursor-pointer transition-all active:scale-90"
											>
												<Minus className="w-3.5 h-3.5" />
											</button>
											<input
												type="number"
												value={cols}
												onChange={(e) => handleColsChange(parseInt(e.target.value) || 1)}
												className="w-full text-center bg-transparent focus:outline-none text-xs font-bold text-text"
											/>
											<button
												onClick={() => handleColsChange(cols + 1)}
												disabled={cols >= MAX_COLS}
												className="p-1.5 bg-card hover:bg-background disabled:opacity-30 rounded-lg text-text cursor-pointer transition-all active:scale-90"
											>
												<Plus className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
								</div>
							</div>

							{/* Structure Splitter */}
							<div className="flex justify-between items-center bg-card/[0.02] border border-border rounded-xl p-3">
								<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Number of Structures</span>
								<select
									value={numStructures}
									onChange={(e) => handleNumStructuresChange(parseInt(e.target.value) || 1)}
									className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-text focus:outline-none w-24 font-bold"
								>
									{numStructuresOptions.map((n) => (
										<option key={n} value={n}>{n} Struct</option>
									))}
								</select>
							</div>

							{/* Pillars configuration */}
							<div className="flex flex-col gap-3.5">
								<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Pillars per structure</span>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex flex-col gap-2">
										<span className="text-[10px] font-bold text-placeholder">North-South</span>
										<select
											value={pillarCount}
											disabled={!allow3PillarsNS}
											onChange={(e) => setPillarCount(parseInt(e.target.value) as 2 | 3)}
											className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-primary w-full font-bold disabled:opacity-40"
										>
											<option value={2}>2 Pillars</option>
											{allow3PillarsNS && <option value={3}>3 Pillars</option>}
										</select>
									</div>
									<div className="flex flex-col gap-2">
										<span className="text-[10px] font-bold text-placeholder">East-West</span>
										<div className="flex items-center bg-background border border-border rounded-xl overflow-hidden p-1 gap-1">
											<button
												onClick={() => setPillarsEW(Math.max(2, pillarsEW - 1))}
												disabled={pillarsEW <= 2}
												className="p-1.5 bg-card hover:bg-background disabled:opacity-30 rounded-lg text-text cursor-pointer transition-all"
											>
												<Minus className="w-3.5 h-3.5" />
											</button>
											<span className="w-full text-center text-xs font-bold text-text">{pillarsEW}</span>
											<button
												onClick={() => setPillarsEW(Math.min(MAX_PILLARS_EW, pillarsEW + 1))}
												disabled={pillarsEW >= MAX_PILLARS_EW}
												className="p-1.5 bg-card hover:bg-background disabled:opacity-30 rounded-lg text-text cursor-pointer transition-all"
											>
												<Plus className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
								</div>
							</div>

							{/* Interactive Grid Cell Toggle Preview */}
							<div className="flex flex-col gap-2">
								<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider flex items-center justify-between">
									<span>Interactive Cell Config</span>
									<span className="text-[9px] text-placeholder lowercase">(Tap cells to enable/disable)</span>
								</span>
								<div className="bg-background/60 border border-border rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] max-h-[220px] overflow-y-auto">
									<div 
										className="grid gap-1.5 p-1"
										style={{ 
											gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
											width: `${Math.min(240, cols * 32)}px`
										}}
									>
										{Array.from({ length: rows }).map((_, r) => {
											const isEndOfStructure = (r + 1) % panelsPerStructure === 0 && (r + 1) !== rows;
											return Array.from({ length: cols }).map((_, c) => {
												const key = `${r}-${c}`;
												const isActive = !removedCells.has(key);
												return (
													<button
														key={key}
														type="button"
														onClick={() => toggleCellActive(r, c)}
														className={`w-7 h-7 rounded border font-sans text-[9px] font-bold flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 ${
															isActive 
																? "bg-primary/20 border-primary text-primary shadow-[0_0_8px_rgba(20,184,166,0.15)]" 
																: "bg-card border-border text-placeholder"
														} ${isEndOfStructure ? "mb-2 border-b-2" : ""}`}
													>
														{r + 1},{c + 1}
													</button>
												);
											});
										})}
									</div>
								</div>
								{/* Stats Indicator */}
								<div className="flex justify-between items-center text-[10px] font-bold mt-1 font-sans">
									<span className={overCapacity ? "text-red-400" : "text-placeholder"}>
										{activePanelsCount} active panels
										{overCapacity && ` • ${activePanelsCount - remainingSlots} extra`}
										{numStructures > 1 && ` • ${numStructures} structures`}
									</span>
									<span className="text-placeholder">
										{remainingSlots === Infinity ? "Limit: None" : `${remainingSlots} slots remaining`}
									</span>
								</div>
							</div>

							{/* Confirm Action Button */}
							<button
								onClick={handleConfirm}
								disabled={overCapacity}
								className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow mt-2"
							>
								<Check className="w-4 h-4" />
								<span>Confirm Configuration & Place</span>
							</button>

						</div>
					)}
				</div>
			</div>
		</div>
	);
}
