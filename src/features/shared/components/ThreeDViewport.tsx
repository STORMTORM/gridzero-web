import React from "react";
import Viewer from "./3d/Viewer";
import type { SceneData } from "../../../utils/design/types";

interface ThreeDViewportProps {
	liveSceneData: SceneData | null;
	stage: string;
	activeCaptureTarget: string | null;
}

export const ThreeDViewport: React.FC<ThreeDViewportProps> = ({
	liveSceneData,
	stage,
	activeCaptureTarget,
}) => {
	return (
		<div className="flex-grow flex-1 h-full relative overflow-hidden bg-neutral-950 border-r border-white/10">
			{liveSceneData ? (
				<>
					<Viewer data={liveSceneData} />
					{stage === "snapshots" && activeCaptureTarget && (
						<div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
							<div
								style={{ aspectRatio: activeCaptureTarget === "corner_snapshot" ? 190 / 80 : 1 }}
								className="w-full max-w-[90%] max-h-[90%] border-2 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative"
							>
								<div className="absolute -top-6 left-0 text-[9px] font-bold text-white uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded">
									{activeCaptureTarget === "corner_snapshot" ? "Proposal Cover Frame (190:80)" : "Shadow Analysis Grid (1:1)"}
								</div>
							</div>
						</div>
					)}
				</>
			) : (
				<div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-500 bg-neutral-950">
					<span className="text-xs font-semibold animate-pulse">Initializing 3D viewport...</span>
				</div>
			)}
		</div>
	);
};
