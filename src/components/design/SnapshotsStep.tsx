import { useState, useEffect } from "react";
import { Camera, RefreshCw, ChevronRight, ChevronLeft, AlertCircle, LayoutGrid, CheckCircle2 } from "lucide-react";
import api from "../../api/client";

interface SnapshotsStepProps {
	sitevisitId: string;
	setActiveCaptureTarget: (target: string | null) => void;
	onContinue: () => void;
}

type SnapshotTarget = "corner_snapshot" | "snapshot_8am" | "snapshot_11am" | "snapshot_2pm" | "snapshot_5pm";

interface TargetConfig {
	key: SnapshotTarget;
	label: string;
	hour: number;
	cam: "sw" | "center";
	height: string;
	zoom: number;
	orient?: "ns";
}

const TARGETS: TargetConfig[] = [
	{ key: "corner_snapshot", label: "Proposal Cover Image", hour: 12, cam: "sw", height: "roof+20", zoom: 0.75 },
	{ key: "snapshot_8am", label: "8:00 AM Shadow Analysis", hour: 8, cam: "center", height: "roof+50", zoom: 0.75, orient: "ns" },
	{ key: "snapshot_11am", label: "11:00 AM Shadow Analysis", hour: 11, cam: "center", height: "roof+50", zoom: 0.75, orient: "ns" },
	{ key: "snapshot_2pm", label: "2:00 PM Shadow Analysis", hour: 14, cam: "center", height: "roof+50", zoom: 0.75, orient: "ns" },
	{ key: "snapshot_5pm", label: "5:00 PM Shadow Analysis", hour: 17, cam: "center", height: "roof+50", zoom: 0.75, orient: "ns" },
];

const SHADOW_HOURS = TARGETS
	.filter((target) => target.key !== "corner_snapshot")
	.map((target) => ({
		column: target.key,
		label: target.label,
		hour: target.hour,
	}));

type StepType = "cover" | "shadows";

function dataURLtoFile(dataurl: string, filename: string): File {
	const arr = dataurl.split(",");
	const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
	const bstr = atob(arr[1]);
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new File([u8arr], filename, { type: mime });
}

export default function SnapshotsStep({
	sitevisitId,
	setActiveCaptureTarget,
	onContinue,
}: SnapshotsStepProps) {
	const [loading, setLoading] = useState(true);
	const [step, setStep] = useState<StepType>("cover");
	const [isCapturing, setIsCapturing] = useState(false);
	const [tempCoverImage, setTempCoverImage] = useState<string | null>(null);
	
	const [capturingShadowTarget, setCapturingShadowTarget] = useState<string | null>(null);
	const [savingCover, setSavingCover] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// URLs of generated snapshots in backend
	const [snapshots, setSnapshots] = useState<Record<string, string>>({});

	const fetchExistingSnapshots = async () => {
		try {
			const res = await api.get(`/visit/snapshots/${sitevisitId}`);
			if (res.data) {
				setSnapshots(res.data);
			}
		} catch (err) {
			console.error("Failed to load existing snapshots", err);
		}
	};

	useEffect(() => {
		if (!sitevisitId) return;
		(async () => {
			setLoading(true);
			await fetchExistingSnapshots();
			setLoading(false);
		})();
	}, [sitevisitId]);

	// Initialize step configuration based on existing data
	useEffect(() => {
		if (loading) return;
		
		if (step === "cover") {
			const hasCover = !!snapshots.corner_snapshot;
			if (!hasCover) {
				setIsCapturing(true);
				setActiveCaptureTarget("corner_snapshot");
				alignCamera("cover");
			} else {
				setIsCapturing(false);
				setActiveCaptureTarget(null);
			}
			setTempCoverImage(null);
		} else {
			const hasAllShadows =
				snapshots.snapshot_8am &&
				snapshots.snapshot_11am &&
				snapshots.snapshot_2pm &&
				snapshots.snapshot_5pm;
			
			if (!hasAllShadows) {
				setIsCapturing(true);
				setActiveCaptureTarget("snapshot_8am");
				alignCamera("shadows");
			} else {
				setIsCapturing(false);
				setActiveCaptureTarget(null);
			}
		}
	}, [step, snapshots, loading]);

	const uploadSnapshot = async (b64: string, type: string) => {
		const file = dataURLtoFile(b64, `${type}.jpg`);
		const fd = new FormData();
		fd.append("file", file);
		fd.append("type", type);
		fd.append("sitevisit_id", sitevisitId);
		await api.post("/visit/file/upload", fd, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});
	};

	const alignCamera = (type: StepType) => {
		const w = window as any;
		if (!w.__setCamera || !w.__setSunTime) return;
		if (type === "cover") {
			w.__setSunTime(12);
			w.__setCamera("sw", "roof+20", 0.75);
		} else {
			w.__setCamera("center", "roof+50", 0.75, "ns");
		}
	};

	// --- Step 1: Cover handlers ---
	const handleCaptureCover = () => {
		const w = window as any;
		if (!w.__capture3D) {
			setError("3D view capture routines are not ready.");
			return;
		}
		const b64 = w.__capture3D();
		if (b64) {
			setTempCoverImage(b64);
			setIsCapturing(false);
			setActiveCaptureTarget(null);
		} else {
			setError("Failed to capture frame.");
		}
	};

	const handleRetakeCover = () => {
		setTempCoverImage(null);
		setIsCapturing(true);
		setActiveCaptureTarget("corner_snapshot");
		alignCamera("cover");
	};

	const handleSaveCover = async () => {
		setError(null);
		if (tempCoverImage) {
			setSavingCover(true);
			try {
				await uploadSnapshot(tempCoverImage, "corner_snapshot");
				await fetchExistingSnapshots();
				setTempCoverImage(null);
				setStep("shadows");
			} catch (err: any) {
				setError(err.message || "Upload failed. Please try again.");
			} finally {
				setSavingCover(false);
			}
		} else {
			setStep("shadows");
		}
	};

	// --- Step 2: Shadows handlers ---
	const handleCaptureShadowSeries = async () => {
		setError(null);
		const w = window as any;
		if (!w.__capture3D || !w.__setSunTime) {
			setError("3D view capture routines are not ready.");
			return;
		}

		try {
			for (const item of SHADOW_HOURS) {
				setCapturingShadowTarget(item.column);
				setActiveCaptureTarget(item.column);
				w.__setSunTime(item.hour);
				// Delay to let shadows render
				await new Promise((r) => setTimeout(r, 600));
				
				const b64 = w.__capture3D();
				if (!b64) throw new Error(`Failed to capture ${item.label}.`);
				
				await uploadSnapshot(b64, item.column);
			}
			
			// Reset sun to noon
			w.__setSunTime(12);
			await fetchExistingSnapshots();
			setIsCapturing(false);
			setActiveCaptureTarget(null);
		} catch (err: any) {
			setError(err.message || "Shadow capture series failed.");
		} finally {
			setCapturingShadowTarget(null);
		}
	};

	const handleRetakeShadows = () => {
		setIsCapturing(true);
		setActiveCaptureTarget("snapshot_8am");
		alignCamera("shadows");
	};

	const displayCoverUrl = tempCoverImage || snapshots.corner_snapshot;
	
	const hasAllShadows =
		snapshots.snapshot_8am &&
		snapshots.snapshot_11am &&
		snapshots.snapshot_2pm &&
		snapshots.snapshot_5pm;

	if (loading) {
		return (
			<div className="flex-grow flex flex-col items-center justify-center gap-3 py-12">
				<RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
				<span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Checking existing snapshots...</span>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col justify-between font-sans text-neutral-200">
			<div className="flex flex-col gap-4">
				{/* Step title & navigation */}
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-0.5">
						<span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
							Step {step === "cover" ? "1" : "2"} of 2
						</span>
						<h3 className="text-xs font-bold text-white uppercase tracking-wide">
							{step === "cover" ? "Proposal Cover Frame" : "Shadow Path Projections"}
						</h3>
					</div>
					{step === "shadows" && !capturingShadowTarget && (
						<button
							onClick={() => setStep("cover")}
							className="p-1.5 hover:bg-white/5 rounded-lg border border-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
							title="Back to Cover"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>
					)}
				</div>

				{/* Error display */}
				{error && (
					<div className="bg-red-500/10 border border-red-500/15 rounded-xl p-3 flex items-start gap-2 text-[10px] font-bold text-red-400 leading-relaxed">
						<AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
						<span>{error}</span>
					</div>
				)}

				{/* ── STEP 1: COVER VIEW ── */}
				{step === "cover" && (
					<div className="flex flex-col gap-4">
						{/* Square Frame */}
						<div className="relative aspect-square w-full rounded-2xl bg-neutral-900 border border-white/10 overflow-hidden flex items-center justify-center shadow-inner group">
							{isCapturing ? (
								<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none bg-black/35">
									<div className="w-full max-w-[85%] aspect-[190/80] border border-dashed border-teal-400/50 rounded-lg flex items-center justify-center bg-teal-500/[0.02] py-4">
										<Camera className="w-5 h-5 text-teal-400 opacity-80 animate-pulse" />
									</div>
									<div className="flex flex-col gap-0.5 mt-2">
										<span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Camera View Active</span>
										<span className="text-[8px] text-neutral-500 leading-normal max-w-[180px]">
											Adjust the 3D model view on the right to align inside this crop guide.
										</span>
									</div>
								</div>
							) : displayCoverUrl ? (
								<img
									src={displayCoverUrl}
									alt="Cover Preview"
									className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
								/>
							) : null}

							{savingCover && (
								<div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2">
									<RefreshCw className="w-6 h-6 text-white animate-spin" />
									<span className="text-[9px] text-white font-bold uppercase tracking-widest animate-pulse">Uploading Cover...</span>
								</div>
							)}
						</div>

						{/* Cover controls */}
						<div className="flex flex-col gap-2.5">
							{isCapturing ? (
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={() => alignCamera("cover")}
										className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer"
									>
										Align View
									</button>
									<button
										onClick={handleCaptureCover}
										className="py-2.5 bg-teal-500 hover:bg-teal-600 text-black text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 font-bold"
									>
										<Camera className="w-3.5 h-3.5" />
										<span>Capture Cover</span>
									</button>
								</div>
							) : (
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={handleRetakeCover}
										disabled={savingCover}
										className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer"
									>
										Retake
									</button>
									<button
										onClick={handleSaveCover}
										disabled={savingCover}
										className="py-2.5 bg-white hover:bg-neutral-200 text-black text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
									>
										<span>{tempCoverImage ? "Save & Continue" : "Continue"}</span>
										<ChevronRight className="w-3.5 h-3.5" />
									</button>
								</div>
							)}
						</div>
					</div>
				)}

				{/* ── STEP 2: SHADOW ANALYSIS ── */}
				{step === "shadows" && (
					<div className="flex flex-col gap-4">
						{/* Square Frame for Alignment/Preview */}
						<div className="relative aspect-square w-full rounded-2xl bg-neutral-900 border border-white/10 overflow-hidden flex items-center justify-center shadow-inner group">
							{isCapturing ? (
								<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none bg-black/35">
									<div className="w-full max-w-[85%] aspect-square border border-dashed border-teal-400/50 rounded-lg flex items-center justify-center bg-teal-500/[0.02]">
										<Camera className="w-5 h-5 text-teal-400 opacity-80 animate-pulse" />
									</div>
									<div className="flex flex-col gap-0.5 mt-2">
										<span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Top-Down View Active</span>
										<span className="text-[8px] text-neutral-500 leading-normal max-w-[180px]">
											Align the roof in the center of the square. Click Capture Series to generate all shadow projections.
										</span>
									</div>
								</div>
							) : (
								/* Grid preview of the 4 generated shadow projection thumbs */
								<div className="w-full h-full p-3 grid grid-cols-2 gap-2 bg-neutral-950/80">
									{SHADOW_HOURS.map((h) => {
										const url = snapshots[h.column];
										return (
											<div key={h.hour} className="relative aspect-[4/3] rounded-lg border border-white/5 bg-neutral-900 overflow-hidden flex items-center justify-center shadow-sm">
												{url ? (
													<img src={url} alt={h.label} className="w-full h-full object-cover" />
												) : (
													<span className="text-[8px] font-bold text-neutral-600">{h.label}</span>
												)}
												{url && (
													<div className="absolute top-1 right-1 bg-emerald-500/90 p-0.5 rounded-full text-white">
														<CheckCircle2 className="w-2.5 h-2.5" />
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}

							{capturingShadowTarget && (
								<div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2.5 p-6 text-center">
									<RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
									<div className="flex flex-col gap-1">
										<span className="text-[10px] text-white font-bold uppercase tracking-wider animate-pulse">
											Capturing Shadow Maps...
										</span>
										<span className="text-[9px] text-neutral-450">
											Rendering shadow projection for {SHADOW_HOURS.find(h => h.column === capturingShadowTarget)?.label || ""}
										</span>
									</div>
								</div>
							)}
						</div>

						{/* Shadow series controls */}
						<div className="flex flex-col gap-2.5">
							{isCapturing ? (
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={() => alignCamera("shadows")}
										disabled={!!capturingShadowTarget}
										className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer"
									>
										Align Top-Down
									</button>
									<button
										onClick={handleCaptureShadowSeries}
										disabled={!!capturingShadowTarget}
										className="py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 font-bold"
									>
										<LayoutGrid className="w-3.5 h-3.5" />
										<span>Capture Series</span>
									</button>
								</div>
							) : (
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={handleRetakeShadows}
										className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer"
									>
										Retake All
									</button>
									<button
										onClick={onContinue}
										disabled={!hasAllShadows}
										className="py-2.5 bg-white hover:bg-neutral-200 text-black text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
									>
										<span>Save & Continue</span>
										<ChevronRight className="w-3.5 h-3.5" />
									</button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
