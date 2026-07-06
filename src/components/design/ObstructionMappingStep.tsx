import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import type { LocalObject } from "../../utils/design/types";
import type { RoofData } from "./RoofMappingStep";

interface ObstructionMappingStepProps {
	roofs: RoofData[];
	objects: LocalObject[];
	selectedObjectId: string | null;
	setSelectedObjectId: (id: string | null) => void;
	objectDrawingMode: string;
	setObjectDrawingMode: (mode: string) => void;
	deleteSelectedObject: () => void;
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
	updateSelectedObject,
	onContinue,
}: ObstructionMappingStepProps) {

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
		<div className="h-full flex flex-col justify-between">
			<div className="flex flex-col gap-6">
				{/* Title */}
				<div>
					<h3 className="text-sm font-bold text-white flex items-center gap-2">
						<span>Obstruction Mapping</span>
					</h3>
					<p className="text-[11px] text-neutral-500 font-medium mt-1">
						Map building segments, water tanks, trees, AC units, and walls.
					</p>
				</div>

				{/* Object Drawing buttons */}
				<div className="flex flex-col gap-3">
					<span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Add Obstruction</span>
					
					{roofs.length === 0 ? (
						<div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex flex-col gap-2 text-rose-350 select-text">
							<span className="text-[11px] font-bold flex items-center gap-1.5">
								⚠️ Placement Disabled
							</span>
							<p className="text-[10px] leading-relaxed text-neutral-400 font-medium">
								You must draw at least one roof boundary in **Stage 2 (Roof Mapping)** before you can place AC units, water tanks, trees, walls, or custom shapes.
							</p>
						</div>
					) : (
						<>
							{/* Tab Selectors */}
							<div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
								<button
									onClick={() => {
										setActiveTab("on_roof");
										setObjectDrawingMode("none");
									}}
									className={`flex-1 py-1 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
										activeTab === "on_roof"
											? "bg-white text-black shadow-sm"
											: "text-neutral-400 hover:text-white"
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
											? "bg-white text-black shadow-sm"
											: "text-neutral-400 hover:text-white"
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
													? "bg-white border-white text-black"
													: "bg-white/5 border-white/5 text-neutral-350 hover:bg-white/10 hover:border-white/10"
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
									className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 text-[10px] font-bold rounded-lg border border-rose-500/10 transition-all cursor-pointer"
								>
									Cancel Placement (ESC)
								</button>
							)}
						</>
					)}
				</div>

				{/* Objects List */}
				<div className="flex flex-col gap-2.5">
					<span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Mapped Objects ({objects.length})</span>
					{objects.length === 0 ? (
						<div className="border border-dashed border-white/10 rounded-2xl p-6 text-center text-xs text-neutral-500">
							No obstructions placed. Select a tool above to outline objects.
						</div>
					) : (
						<div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
							{objects.map((obj) => {
								const isSelected = obj.id === selectedObjectId;
								const dispH = (obj.z_end - obj.z_init).toFixed(1);
								const subtype = obj.tag ? `${obj.tag}` : obj.type;

								return (
									<div
										key={obj.id}
										onClick={() => setSelectedObjectId(obj.id)}
										className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
											isSelected
												? "bg-white/10 border-white text-white"
												: "bg-white/5 border-white/5 text-neutral-400 hover:border-white/10 hover:text-white"
										}`}
									>
										<div className="flex flex-col gap-0.5">
											<span className="text-xs font-bold">{obj.name}</span>
											<span className="text-[10px] text-neutral-500 capitalize">
												Type: {subtype} · Height: {dispH}m
											</span>
										</div>
										{isSelected && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Selected Object properties */}
				{selectedObject && (
					<div className="border-t border-white/10 pt-5 flex flex-col gap-5 bg-transparent animate-in slide-in-from-bottom duration-250">
						<div className="flex justify-between items-center">
							<span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Object Parameters</span>
							<button
								onClick={deleteSelectedObject}
								className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/10 transition-colors cursor-pointer"
								title="Delete selected object"
							>
								<Trash2 size={13} />
							</button>
						</div>

						{/* Height parameters */}
						<div className="flex flex-col gap-4">
							{/* Object Height */}
							<div className="flex flex-col gap-1.5">
								<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
									<span>Height</span>
									<span className="text-white font-bold">{objHeight.toFixed(1)}m</span>
								</div>
								<input
									type="range"
									min="0.2"
									max="15"
									step="0.1"
									value={objHeight}
									onChange={(e) => {
										const h = parseFloat(e.target.value);
										updateSelectedObject({
											z_end: selectedObject.z_init + h,
										});
									}}
									className="w-full accent-white cursor-pointer"
								/>
							</div>

							{/* Base Elevation (editable only for wall/polygon or objects not locked to on_roof) */}
							<div className="flex flex-col gap-1.5">
								<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
									<span>Base Elevation (z_init)</span>
									<span className="text-white font-bold">{selectedObject.z_init.toFixed(1)}m</span>
								</div>
								<input
									type="range"
									min="0"
									max="30"
									step="0.1"
									value={selectedObject.z_init}
									disabled={selectedObject.on_roof || selectedObject.type === "tree" || selectedObject.tag === "building"}
									onChange={(e) => {
										const z = parseFloat(e.target.value);
										const prevH = selectedObject.z_end - selectedObject.z_init;
										updateSelectedObject({
											z_init: z,
											z_end: z + prevH,
										});
									}}
									className="w-full accent-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
								/>
							</div>

							{/* Dimensions based on object type */}
							{selectedObject.type === "cuboid" && (
								<div className="flex flex-col gap-4 border-t border-white/5 pt-3">
									{/* Model type selection */}
									<div className="flex flex-col gap-1.5">
										<label className="text-[11px] font-semibold text-neutral-400">Object Model Type</label>
										<select
											value={selectedObject.tag || ""}
											onChange={(e) => updateSelectedObject({ tag: e.target.value || undefined })}
											className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-white transition-colors"
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
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Length</span>
											<span className="text-white font-bold">{selectedObject.length?.toFixed(1)}m</span>
										</div>
										<input
											type="range"
											min="0.5"
											max="20"
											step="0.1"
											value={selectedObject.length || 2}
											onChange={(e) => updateSelectedObject({ length: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>

									{/* Width */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Width</span>
											<span className="text-white font-bold">{selectedObject.width?.toFixed(1)}m</span>
										</div>
										<input
											type="range"
											min="0.5"
											max="20"
											step="0.1"
											value={selectedObject.width || 2}
											onChange={(e) => updateSelectedObject({ width: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>

									{/* Angle */}
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Rotation Angle</span>
											<span className="text-white font-bold">{selectedObject.angle || 0}°</span>
										</div>
										<input
											type="range"
											min="-180"
											max="180"
											step="1"
											value={selectedObject.angle || 0}
											onChange={(e) => updateSelectedObject({ angle: parseInt(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>
								</div>
							)}

							{(selectedObject.type === "cylinder" || selectedObject.type === "tree") && (
								<div className="flex flex-col gap-4 border-t border-white/5 pt-3">
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
											<span>Radius</span>
											<span className="text-white font-bold">{selectedObject.radius?.toFixed(1)}m</span>
										</div>
										<input
											type="range"
											min="0.3"
											max="8"
											step="0.1"
											value={selectedObject.radius || 1}
											onChange={(e) => updateSelectedObject({ radius: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>

									{selectedObject.type === "cylinder" && (
										<div className="flex flex-col gap-1.5">
											<label className="text-[11px] font-semibold text-neutral-400">Cylinder Model Type</label>
											<select
												value={selectedObject.tag || ""}
												onChange={(e) => updateSelectedObject({ tag: e.target.value || undefined })}
												className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-white transition-colors"
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
											<label className="text-[11px] font-semibold text-neutral-400">Tree Species Model</label>
											<select
												value={selectedObject.tag || "mango"}
												onChange={(e) => updateSelectedObject({ tag: e.target.value })}
												className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
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
								<div className="flex flex-col gap-4 border-t border-white/5 pt-3">
									<div className="flex flex-col gap-1.5">
										<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-450">
											<span>Wall Thickness</span>
											<span className="text-white font-bold">{selectedObject.thickness?.toFixed(2)}m</span>
										</div>
										<input
											type="range"
											min="0.1"
											max="1"
											step="0.01"
											value={selectedObject.thickness || 0.23}
											onChange={(e) => updateSelectedObject({ thickness: parseFloat(e.target.value) })}
											className="w-full accent-white cursor-pointer"
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Bottom Action bar */}
			<div className="border-t border-white/10 pt-4 flex gap-3">
				<button
					onClick={onContinue}
					className="flex-grow py-3 bg-white text-black font-bold text-xs rounded-xl shadow-lg hover:bg-neutral-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
				>
					<Check size={14} />
					<span>Save & Continue</span>
				</button>
			</div>
		</div>
	);
}
