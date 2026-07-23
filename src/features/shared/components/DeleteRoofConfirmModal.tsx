import { X, AlertTriangle } from "lucide-react";

interface DeleteRoofConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	roofName?: string;
}

export default function DeleteRoofConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	roofName,
}: DeleteRoofConfirmModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="bg-background border border-border w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all transform animate-in zoom-in-95 duration-200">
				
				{/* Modal Header */}
				<div className="px-6 py-4.5 border-b border-border flex justify-between items-center bg-background/[0.02]">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
							<AlertTriangle className="w-4 h-4" />
						</div>
						<h2 className="text-sm font-bold text-text tracking-tight">
							Delete {roofName || "this roof"}?
						</h2>
					</div>
					
					<button
						onClick={onClose}
						className="text-placeholder hover:text-text p-1 hover:bg-background rounded-lg transition-all cursor-pointer"
						aria-label="Close modal"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Modal Content */}
				<div className="p-6 flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<p className="text-xs text-text leading-relaxed font-semibold">
							Are you sure you want to permanently delete {roofName ? <strong className="text-text font-extrabold">{roofName}</strong> : "this roof"}?
						</p>
						<p className="text-[11px] text-placeholder leading-relaxed font-medium">
							Deleting this roof will also remove all obstructions and solar panel layouts placed on it. This action cannot be undone.
						</p>
					</div>

					{/* Action Buttons */}
					<div className="grid grid-cols-2 gap-3 mt-2">
						<button
							type="button"
							onClick={onClose}
							className="py-2.5 bg-card hover:bg-card/80 border border-border text-text text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={onConfirm}
							className="py-2.5 bg-red-700 hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-[0_4px_12px_rgba(167,206,56,0.15)] flex items-center justify-center gap-1.5"
						>
							<span>Delete Roof</span>
						</button>
					</div>
				</div>

			</div>
		</div>
	);
}
