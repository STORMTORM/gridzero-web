import { useState } from "react";
import { Check, Trash2, Copy } from "lucide-react";
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
	deleteSelectedObject: () => void;
	duplicateSelectedObject: () => void;
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
					<h3 className="text-sm font-bold text-text flex items-center gap-2">
						<span>Obstruction Mapping</span>
					</h3>
					<p className="text-[11px] text-placeholder font-medium mt-1">
						Map building segments, water tanks, trees, AC units, and walls.
					</p>
				</div>

				{/* Object Drawing buttons */}
				<div className="flex flex-col gap-3">
					<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Add Obstruction</span>
					
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
									className={`flex-1 py-1 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
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
									className={`flex-1 py-1 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
										activeTab === "off_roof"
											? "bg-primary text-white shadow-sm"
											: "text-placeholder hover:text-text"
									}`}
								>
									Off Roof (Ground)
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
					<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Mapped Objects ({objects.length})</span>
					{objects.length === 0 ? (
						<div className="border border-dashed border-border rounded-2xl p-6 text-center text-xs text-placeholder">
							No obstructions placed. Select a tool above to outline objects.
						</div>
					) : (
						<div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
							{objects.map((obj) => {
								const isSelected = obj.id === selectedObjectId;
								const dispH = obj.z_end - obj.z_init;
								const subtype = obj.tag ? `${obj.tag}` : obj.type;

								return (
									<div
										key={obj.id}
										onClick={() => setSelectedObjectId(obj.id)}
										className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
											isSelected
												? "bg-primary/10 border-primary text-primary"
												: "bg-card border-border/50 text-placeholder hover:border-border hover:text-text"
										}`}
									>
										<div className="flex flex-col gap-0.5">
											<span className="text-xs font-bold">{obj.name}</span>
											<span className="text-[10px] text-placeholder capitalize">
												Type: {subtype} · Height: {formatVal(dispH, 1)}
											</span>
										</div>
										{isSelected && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
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
							<span className="text-[10px] font-bold text-placeholder uppercase tracking-wider">Object Parameters</span>
							<div className="flex gap-1.5">
								<button
									onClick={duplicateSelectedObject}
									className="p-1.5 rounded-lg bg-card hover:bg-background text-placeholder hover:text-text border border-border transition-colors cursor-pointer"
									title="Duplicate object"
								>
									<Copy size={13} />
								</button>
								<button
									onClick={deleteSelectedObject}
									className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border border-rose-500/10 transition-colors cursor-pointer"
									title="Delete selected object"
								>
									<Trash2 size={13} />
								</button>
							</div>
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

							{/* Base Elevation */}
							<div className="flex flex-col gap-1.5">
								<div className="flex justify-between items-center text-[11px] font-semibold text-placeholder">
									<span>Base Elevation (z_init)</span>
									<span className="text-text font-bold">{formatVal(selectedObject.z_init, 1)}</span>
								</div>
								<input
									type="range"
									min="0"
									max={unit === "ft" ? 100 : 30}
									step="0.1"
									value={Math.round(mToUnit(selectedObject.z_init) * 10) / 10}
									disabled={selectedObject.on_roof || selectedObject.type === "tree" || selectedObject.tag === "building"}
									onChange={(e) => {
										const z = unitToM(parseFloat(e.target.value));
										const prevH = selectedObject.z_end - selectedObject.z_init;
										updateSelectedObject({
											z_init: z,
											z_end: z + prevH,
										});
									}}
									className="w-full accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
								/>
							</div>

							{/* Dimensions based on object type */}
							{selectedObject.type === "cuboid" && (
								<div className="flex flex-col gap-4 border-t border-border pt-3">
									<div className="flex flex-col gap-1.5">
										<label className="text-[11px] font-semibold text-placeholder">Object Model Type</label>
										<select
											value={selectedObject.tag || ""}
											onChange={(e) => updateSelectedObject({ tag: e.target.value || undefined })}
											className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text focus:outline-none focus:border-primary transition-colors"
										>
											<option value="">Basic Cuboid Block</option>
											<option value="mumtee">Stair Cabin (Mumtee)</option>
											<option value="rectangular_tank">Rectangular Water Tank</option>
											<option value="chimney_box">Chimney Box</option>
											<option value="skylight">Skylight Window</option>
											<option value="elevated">Elevated Structure</option>
											<option value="building">Adjacent Building</option>
											<option value="tower">Utility Tower</option>
										</select>
									</div>

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

									{selectedObject.type === "cylinder" && (
										<div className="flex flex-col gap-1.5">
											<label className="text-[11px] font-semibold text-placeholder">Cylinder Model Type</label>
											<select
												value={selectedObject.tag || ""}
												onChange={(e) => updateSelectedObject({ tag: e.target.value || undefined })}
												className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text focus:outline-none focus:border-primary transition-colors"
											>
												<option value="">Basic Cylinder Block</option>
												<option value="chimney">Circular Chimney</option>
												<option value="cylinder_tank">Vertical Cylinder Tank</option>
												<option value="overhead_tank">Overhead Water Tank</option>
												<option value="horizontal_tank">Horizontal Tank</option>
												<option value="dish">Dish Antenna</option>
											</select>
										</div>
									)}

									{selectedObject.type === "tree" && (
										<div className="flex flex-col gap-1.5">
											<label className="text-[11px] font-semibold text-placeholder">Tree Species Model</label>
											<select
												value={selectedObject.tag || "mango"}
												onChange={(e) => updateSelectedObject({ tag: e.target.value })}
												className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text focus:outline-none"
											>
												<option value="mango">Mango Tree</option>
												<option value="coconut">Coconut Palm</option>
												<option value="neem">Neem Tree</option>
												<option value="pine">Pine Tree</option>
											</select>
										</div>
									)}
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
					<span>Save & Continue</span>
				</button>
			</div>
		</div>
	);
}
