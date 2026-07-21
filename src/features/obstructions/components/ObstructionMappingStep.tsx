import { useState } from "react";
import { Check, Trash2, Copy, Pen } from "lucide-react";
import type { LocalObject } from "../../../utils/design/types";
import type { RoofData } from "../../shared/types";
import { useUnit } from "../../shared/contexts/UnitContext";

interface ObstructionMappingStepProps {
	roofs: RoofData[];
	objects: LocalObject[];
	selectedObjectId: string | null;
	setSelectedObjectId: (id: string | null) => void;
	objectDrawingMode: string;
	setObjectDrawingMode: (mode: string) => void;
	deleteSelectedObject: (objId?: string) => void;
	duplicateSelectedObject: (objId?: string) => void;
	updateSelectedObject: (fields: Partial<LocalObject>) => void;
	onContinue: () => void;
}

export default function ObstructionMappingStep({
	roofs,
	objects,
	selectedObjectId,
	setSelectedObjectId,
	objectDrawingMode,
	setObjectDrawingMode,
	deleteSelectedObject,
	duplicateSelectedObject,
	updateSelectedObject,
	onContinue,
}: ObstructionMappingStepProps) {

	const { unit, mToUnit, unitToM, formatVal } = useUnit();
	const selectedObject = objects.find((o) => o.id === selectedObjectId);
	const objHeight = selectedObject ? (selectedObject.z_end - selectedObject.z_init) : 0;

	// Tabs: "on_roof" (snapped to roof height) and "off_roof" (on ground)
	const [activeTab, setActiveTab] = useState<"on_roof" | "off_roof">("on_roof");

	const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
	const [tempObjectName, setTempObjectName] = useState("");

	const handleStartEdit = (e: React.MouseEvent, obj: LocalObject) => {
		e.stopPropagation();
		setSelectedObjectId(obj.id);
		setEditingObjectId(obj.id);
		setTempObjectName(obj.name || "");
	};

	const handleSaveName = () => {
		if (tempObjectName.trim()) {
			updateSelectedObject({ name: tempObjectName.trim() });
		}
		setEditingObjectId(null);
	};

	const onRoofCategories = [
		{ key: "ac_unit", label: "AC Unit" },
		{ key: "water_tanker", label: "Water Tank" },
		{ key: "elevated", label: "Elevated" },
		{ key: "dish", label: "Dish" },
		{ key: "chimney", label: "Chimney" },
		{ key: "skylight", label: "Skylight" },
		{ key: "mumtee", label: "Mumtee" },
	];

	const offRoofCategories = [
		{ key: "tree", label: "Tree" },
		{ key: "building", label: "Building" },
		{ key: "cuboid_ground", label: "Cuboid" },
		{ key: "tanker", label: "Overhead Water Tank" },
		{ key: "tower", label: "Tower" },
		{ key: "cylinder_ground", label: "Cylinder" },
	];

	const activeCategories = activeTab === "on_roof" ? onRoofCategories : offRoofCategories;

	return (
		<div className="flex flex-col h-full justify-between overflow-hidden">
			<div className="flex flex-col gap-6 flex-grow overflow-y-auto pr-1 pb-4">
				{/* Title */}
				<div>
					<h3 className="text-xl font-bold text-text flex items-center gap-2">
						<span>Object Settings</span>
					</h3>
				</div>

				{/* Object Drawing buttons */}
				<div className="flex flex-col gap-3">
					<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Add Objects</span>
					
					{roofs.length === 0 ? (
						<div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex flex-col gap-2 text-rose-350 select-text">
							<span className="text-[11px] font-bold flex items-center gap-1.5">
								⚠️ Placement Disabled
							</span>
							<p className="text-[10px] leading-relaxed text-placeholder font-medium">
								You must draw at least one roof boundary in **Stage 2 (Roof Mapping)** before you can place AC units, water tanks, trees, walls, or custom shapes.
							</p>
						</div>
					) : (
						<>
							{/* Tab Selectors */}
							<div className="flex bg-card p-1 rounded-xl border border-border">
								<button
									onClick={() => {
										setActiveTab("on_roof");
										setObjectDrawingMode("none");
									}}
									className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
										activeTab === "on_roof"
											? "bg-primary text-white shadow-sm"
											: "text-placeholder hover:text-text"
									}`}
								>
									On Roof
								</button>
								<button
									onClick={() => {
										setActiveTab("off_roof");
										setObjectDrawingMode("none");
									}}
									className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
										activeTab === "off_roof"
											? "bg-primary text-white shadow-sm"
											: "text-placeholder hover:text-text"
									}`}
								>
									Off Roof
								</button>
							</div>

							{/* Buttons Grid */}
							<div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
								{activeCategories.map((cat, idx) => {
									const isActive = objectDrawingMode === cat.key;
									
									return (
										<button
											key={idx}
											onClick={() => {
												if (isActive) {
													setObjectDrawingMode("none");
												} else {
													setObjectDrawingMode(cat.key);
													setSelectedObjectId(null);
												}
											}}
											className={`py-1.5 px-2.5 rounded-xl border text-left text-[10px] font-bold transition-all cursor-pointer ${
												isActive
													? "bg-primary border-primary text-white"
													: "bg-card border-border/50 text-placeholder hover:bg-background hover:border-border"
											}`}
										>
											{cat.label}
										</button>
									);
								})}
							</div>

							{objectDrawingMode !== "none" && (
								<button
									onClick={() => setObjectDrawingMode("none")}
									className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 text-[10px] font-bold rounded-lg border border-rose-500/10 transition-all cursor-pointer"
								>
									Cancel Placement (ESC)
								</button>
							)}
						</>
					)}
				</div>

				{/* Mapped Objects List */}
				<div className="flex flex-col gap-2.5">
					<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Placed Objects ({objects.length})</span>
					{objects.length === 0 ? (
						<div className="border border-dashed border-border rounded-2xl p-6 text-center text-xs text-placeholder">
							No obstructions placed. Select a tool above to outline objects.
						</div>
					) : (
						<div className="flex flex-col gap-2 max-h-52 overflow-y-auto scrollbar-none bg-card p-2 border rounded-xl border-border">
							{objects.map((obj) => {
								const isSelected = obj.id === selectedObjectId;
								const dispH = obj.z_end - obj.z_init;
								const subtype = obj.tag ? `${obj.tag}` : obj.type;

								return (
									<div
										key={obj.id}
										onClick={() => setSelectedObjectId(obj.id)}
										className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
											isSelected
												? "bg-primary/10 border-primary text-primary"
												: "bg-card border-border/50 text-placeholder hover:border-border hover:text-text"
										}`}
									>
										<div className="flex-grow flex flex-col gap-0.5 min-w-0 pr-2">
											{editingObjectId === obj.id ? (
												<input
													type="text"
													value={tempObjectName}
													onChange={(e) => setTempObjectName(e.target.value)}
													onBlur={() => handleSaveName()}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															handleSaveName();
														} else if (e.key === "Escape") {
															setEditingObjectId(null);
														}
													}}
													className="bg-background border border-border rounded-lg px-2 py-0.5 text-xs font-bold text-text focus:outline-none focus:border-primary w-full animate-in fade-in duration-100"
													autoFocus
													onClick={(e) => e.stopPropagation()}
												/>
											) : (
												<div className="flex items-center gap-1.5 group/title min-w-0">
													<span className="text-xs font-bold truncate">{obj.name}</span>
													<button
														type="button"
														onClick={(e) => handleStartEdit(e, obj)}
														className="text-placeholder hover:text-text opacity-0 group-hover/title:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-background flex items-center justify-center border border-transparent hover:border-border"
														title="Edit name"
													>
														<Pen className="w-2.5 h-2.5" />
													</button>
												</div>
											)}
											<span className="text-[10px] text-placeholder capitalize">
												Type: {subtype} · Height: {formatVal(dispH, 1)}
											</span>
										</div>
										<div className="flex items-center gap-1.5 flex-shrink-0">
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
												<button
													type="button"
													onClick={() => duplicateSelectedObject(obj.id)}
													className="p-1 rounded-lg bg-background hover:bg-border text-placeholder hover:text-text border border-border transition-colors cursor-pointer flex items-center justify-center"
													title="Duplicate object"
												>
													<Copy className="w-3.5 h-3.5" />
												</button>
												<button
													type="button"
													onClick={() => deleteSelectedObject(obj.id)}
													className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border border-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
													title="Delete object"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</div>
											{isSelected && <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0 group-hover:hidden ml-1" />}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Selected Object properties */}
				{selectedObject && (
					<div className="border-t border-border pt-5 flex flex-col gap-5 bg-transparent animate-in slide-in-from-bottom duration-250">
						<div className="flex justify-between items-center">
							<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Object Dimensions</span>
						</div>

						{/* Height parameters */}
						<div className="flex flex-col gap-4">
							{/* Object Height */}
							<div className="flex flex-col gap-1.5">
								<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
									<span>Height</span>
									<span className="text-text font-bold">{formatVal(objHeight, 1)}</span>
								</div>
								<input
									type="range"
									min={unit === "ft" ? 0.6 : 0.2}
									max={unit === "ft" ? 50 : 15}
									step="0.1"
									value={Math.round(mToUnit(objHeight) * 10) / 10}
									onChange={(e) => {
										const h = unitToM(parseFloat(e.target.value));
										updateSelectedObject({
											z_end: selectedObject.z_init + h,
										});
									}}
									className="w-full accent-primary cursor-pointer"
								/>
							</div>

							{/* Dimensions based on object type */}
							{selectedObject.type === "cuboid" && (
								<div className="flex flex-col gap-4">

									{/* Length */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
											<span>Length</span>
											<span className="text-text font-bold">{formatVal(selectedObject.length || 2, 1)}</span>
										</div>
										<input
											type="range"
											min={unit === "ft" ? 1.5 : 0.5}
											max={unit === "ft" ? 65 : 20}
											step="0.1"
											value={Math.round(mToUnit(selectedObject.length || 2) * 10) / 10}
											onChange={(e) => updateSelectedObject({ length: unitToM(parseFloat(e.target.value)) })}
											className="w-full accent-primary cursor-pointer"
										/>
									</div>

									{/* Width */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
											<span>Width</span>
											<span className="text-text font-bold">{formatVal(selectedObject.width || 2, 1)}</span>
										</div>
										<input
											type="range"
											min={unit === "ft" ? 1.5 : 0.5}
											max={unit === "ft" ? 65 : 20}
											step="0.1"
											value={Math.round(mToUnit(selectedObject.width || 2) * 10) / 10}
											onChange={(e) => updateSelectedObject({ width: unitToM(parseFloat(e.target.value)) })}
											className="w-full accent-primary cursor-pointer"
										/>
									</div>

									{/* Angle */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
											<span>Rotation Angle</span>
											<span className="text-text font-bold">{selectedObject.angle || 0}°</span>
										</div>
										<input
											type="range"
											min="-180"
											max="180"
											step="1"
											value={selectedObject.angle || 0}
											onChange={(e) => updateSelectedObject({ angle: parseInt(e.target.value) })}
											className="w-full accent-primary cursor-pointer"
										/>
									</div>
								</div>
							)}

							{(selectedObject.type === "cylinder" || selectedObject.type === "tree") && (
								<div className="flex flex-col gap-4 border-t border-border pt-3">
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
											<span>Radius</span>
											<span className="text-text font-bold">{formatVal(selectedObject.radius || 1, 1)}</span>
										</div>
										<input
											type="range"
											min={unit === "ft" ? 1.0 : 0.3}
											max={unit === "ft" ? 26.0 : 8.0}
											step="0.1"
											value={Math.round(mToUnit(selectedObject.radius || 1) * 10) / 10}
											onChange={(e) => updateSelectedObject({ radius: unitToM(parseFloat(e.target.value)) })}
											className="w-full accent-primary cursor-pointer"
										/>
									</div>
								</div>
							)}

							{selectedObject.type === "wall" && (
								<div className="flex flex-col gap-4 border-t border-border pt-3">
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
											<span>Wall Thickness</span>
											<span className="text-text font-bold">{formatVal(selectedObject.thickness || 0.23, 2)}</span>
										</div>
										<input
											type="range"
											min={unit === "ft" ? 0.3 : 0.1}
											max={unit === "ft" ? 3.3 : 1.0}
											step={0.01}
											value={Math.round(mToUnit(selectedObject.thickness || 0.23) * 100) / 100}
											onChange={(e) => updateSelectedObject({ thickness: unitToM(parseFloat(e.target.value)) })}
											className="w-full accent-primary cursor-pointer"
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Bottom Action bar */}
			<div className="border-t border-border pt-4 mt-auto flex-shrink-0 flex gap-3">
				<button
					onClick={onContinue}
					className="flex-grow py-3 bg-primary text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
				>
					<Check size={14} />
					<span>Next</span>
				</button>
			</div>
		</div>
	);
}
