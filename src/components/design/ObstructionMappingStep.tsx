import { Check, Trash2 } from "lucide-react";
import type { LocalObject } from "../../utils/design/types";
import type { RoofData } from "./RoofMappingStep";

interface ObstructionMappingStepProps {
	roofs: RoofData[];
	objects: LocalObject[];
	selectedObjectId: string | null;
	setSelectedObjectId: (id: string | null) => void;
	objectDrawingMode: "none" | "ac_unit" | "mumtee" | "water_tank" | "tree" | "wall" | "polygon";
	setObjectDrawingMode: (mode: "none" | "ac_unit" | "mumtee" | "water_tank" | "tree" | "wall" | "polygon") => void;
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

	const objectCategories = [
		{ key: "mumtee", label: "Stair Cabin" },
		{ key: "ac_unit", label: "AC Unit" },
		{ key: "water_tank", label: "Water Tank" },
		{ key: "tree", label: "Tree" },
		{ key: "wall", label: "Boundary Wall" },
		{ key: "polygon", label: "Custom Shape" },
	];

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
				<div className="flex flex-col gap-2">
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
							<div className="grid grid-cols-2 gap-2">
								{objectCategories.map((cat, idx) => {
									const isActive = objectDrawingMode === cat.key;
									
									return (
										<button
											key={idx}
											onClick={() => {
												if (isActive) {
													setObjectDrawingMode("none");
												} else {
													setObjectDrawingMode(cat.key as any);
													setSelectedObjectId(null);
												}
											}}
											className={`py-2 px-3 rounded-xl border text-left text-[11px] font-bold transition-all cursor-pointer ${
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
									className="w-full mt-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 text-[10px] font-bold rounded-lg border border-rose-500/10 transition-all cursor-pointer"
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
								className="p-1 hover:bg-rose-500/10 text-neutral-500 hover:text-rose-455 rounded-lg transition-colors cursor-pointer"
								title="Delete Selected Object"
							>
								<Trash2 className="w-4 h-4" />
							</button>
						</div>

						{/* Name field */}
						<div className="flex flex-col gap-1.5">
							<label className="text-[11px] font-semibold text-neutral-400">Object Name</label>
							<input
								type="text"
								value={selectedObject.name}
								onChange={(e) => updateSelectedObject({ name: e.target.value })}
								className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-white transition-colors"
							/>
						</div>

						{/* Snap to Roof setting */}
						<div className="border border-white/5 bg-white/5 p-3 rounded-xl flex flex-col gap-3">
							<div className="flex justify-between items-center">
								<div className="flex flex-col gap-0.5">
									<span className="text-[11px] font-bold">Snap onto a Roof</span>
									<span className="text-[9px] text-neutral-500">Elevate object to sit directly on a roof</span>
								</div>
								<label className="relative inline-flex items-center cursor-pointer select-none">
									<input
										type="checkbox"
										checked={selectedObject.on_roof}
										onChange={(e) => {
											const checked = e.target.checked;
											let firstRoofId = selectedObject.roof_id;
											let baseElevation = selectedObject.z_init;

											if (checked && roofs.length > 0) {
												firstRoofId = roofs[0].id;
												baseElevation = roofs[0].height;
											} else if (!checked) {
												baseElevation = 0;
											}

											updateSelectedObject({
												on_roof: checked,
												roof_id: checked ? firstRoofId : undefined,
												z_init: baseElevation,
												z_end: baseElevation + objHeight,
											});
										}}
										className="sr-only peer"
									/>
									<div className="w-8 h-4.5 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-500 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:bg-white peer-checked:bg-white/20 border border-white/10"></div>
								</label>
							</div>

							{selectedObject.on_roof && roofs.length > 0 && (
								<div className="flex flex-col gap-1.5">
									<label className="text-[9px] font-bold text-neutral-500 uppercase">Select Target Roof</label>
									<select
										value={selectedObject.roof_id || ""}
										onChange={(e) => {
											const roof = roofs.find((r) => r.id === e.target.value);
											if (roof) {
												updateSelectedObject({
													roof_id: roof.id,
													z_init: roof.height,
													z_end: roof.height + objHeight,
												});
											}
										}}
										className="w-full bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
									>
										{roofs.map((r) => (
											<option key={r.id} value={r.id}>{r.name} ({r.height}m)</option>
										))}
									</select>
								</div>
							)}
						</div>

						{/* Base elevation (Z Init) */}
						{!selectedObject.on_roof && (
							<div className="flex flex-col gap-1.5">
								<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
									<span>Base Elevation (z-start)</span>
									<span className="text-white font-bold">{selectedObject.z_init.toFixed(1)}m</span>
								</div>
								<input
									type="range"
									min="0"
									max="15"
									step="0.5"
									value={selectedObject.z_init}
									onChange={(e) => {
										const zi = parseFloat(e.target.value);
										updateSelectedObject({
											z_init: zi,
											z_end: zi + objHeight,
										});
									}}
									className="w-full accent-white cursor-pointer"
								/>
							</div>
						)}

						{/* Height slider */}
						<div className="flex flex-col gap-1.5">
							<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
								<span>Object Height</span>
								<span className="text-white font-bold">{objHeight.toFixed(1)}m</span>
							</div>
							<input
								type="range"
								min="0.2"
								max="10"
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
									</select>
								</div>

								{/* Length */}
								<div className="flex flex-col gap-1.5">
									<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
										<span>Length (x-axis)</span>
										<span className="text-white font-bold">{selectedObject.length?.toFixed(1)}m</span>
									</div>
									<input
										type="range"
										min="0.5"
										max="10"
										step="0.1"
										value={selectedObject.length || 2}
										onChange={(e) => updateSelectedObject({ length: parseFloat(e.target.value) })}
										className="w-full accent-white cursor-pointer"
									/>
								</div>

								{/* Width */}
								<div className="flex flex-col gap-1.5">
									<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
										<span>Width (y-axis)</span>
										<span className="text-white font-bold">{selectedObject.width?.toFixed(1)}m</span>
									</div>
									<input
										type="range"
										min="0.5"
										max="10"
										step="0.1"
										value={selectedObject.width || 2}
										onChange={(e) => updateSelectedObject({ width: parseFloat(e.target.value) })}
										className="w-full accent-white cursor-pointer"
									/>
								</div>

								{/* Rotation Angle */}
								<div className="flex flex-col gap-1.5">
									<div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
										<span>Rotation Angle</span>
										<span className="text-white font-bold">{selectedObject.angle || 0}°</span>
									</div>
									<input
										type="range"
										min="0"
										max="360"
										step="5"
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
				)}
			</div>

			{/* Continue Button */}
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
