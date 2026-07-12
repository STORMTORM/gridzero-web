import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Zap,
	Briefcase,
	Home as HomeIcon,
	RefreshCw,
	ChevronRight,
} from "lucide-react";
import ProjectTopbar from "../../components/ProjectTopbar";
import { useProjectForm } from "../../features/customer/hooks/useProjectForm";

const STATE_DISCOM_MAP: Record<string, string[]> = {
	"Andhra Pradesh": ["APEPDCL (Eastern Power Distribution Company of AP)", "APSPDCL (Southern Power Distribution Company of AP)"],
	"Chhattisgarh": ["CSPDCL (Chhattisgarh State Power Distribution Company Limited)"],
	"Delhi": ["BRPL (BSES Rajdhani Power Limited)", "BYPL (BSES Yamuna Power Limited)", "TPDDL (Tata Power Delhi Distribution Limited)"],
	"Gujarat": ["DGVCL (Dakshin Gujarat Vij Company Limited)", "MGVCL (Madhya Gujarat Vij Company Limited)", "PGVCL (Paschim Gujarat Vij Company Limited)", "UGVCL (Uttar Gujarat Vij Company Limited)"],
	"Haryana": ["DHBVN (Dakshin Haryana Bijli Vitran)", "UHBVN (Uttar Haryana Bijli Vitran)"],
	"Karnataka": ["BESCOM (Bangalore Electricity Supply)", "GESCOM (Gulbarga Electricity Supply)", "HESCOM (Hubli Electricity Supply)", "MESCOM (Mangalore Electricity Supply)"],
	"Kerala": ["KSEB (Kerala State Electricity Board)"],
	"Madhya Pradesh": ["MPPKVVCL (MP Paschim Kshetra)", "MPMKVVCL (MP Madhya Kshetra)", "MPAKVVCL (MP Poorv Kshetra)"],
	"Maharashtra": ["MSEDCL / Mahavitaran", "Tata Power Mumbai", "Adani Electricity Mumbai", "BEST Mumbai"],
	"Rajasthan": ["JVVNL (Jaipur Vidyut Vitran)", "AVVNL (Ajmer Vidyut Vitran)", "JDVVNL (Jodhpur Vidyut Vitran)"],
	"Tamil Nadu": ["TANGEDCO (Tamil Nadu Generation and Distribution Corp)"],
	"Telangana": ["TSNPDCL (Telangana State Northern Power)", "TSSPDCL (Telangana State Southern Power)"],
	"Uttar Pradesh": ["PVVNL (Paschimanchal Vidyut Vitran)", "DVVNL (Dakshinanchal Vidyut Vitran)", "MVVNL (Madhyanchal Vidyut Vitran)", "PuVVNL (Purvanchal Vidyut Vitran)"],
	"West Bengal": ["WBSEDCL (West Bengal State Electricity)", "CESC Limited (Kolkata)"]
};

export default function CustomerDetail() {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();

	const {
		formValues,
		metadata,
		updateField,
		loading,
		saving,
		isAutoSaving,
		submitForm,
	} = useProjectForm(id);

	// Dynamic DISCOM choices based on state selection
	const discomOptions = useMemo(() => {
		return STATE_DISCOM_MAP[formValues.state] ?? [];
	}, [formValues.state]);

	const handleNextStep = async () => {
		try {
			await submitForm(true);
			navigate(`/project/${id}/design`);
		} catch (e) {
			console.error("Failed to finalize details", e);
		}
	};

	if (loading) {
		return (
			<div className="flex-grow flex items-center justify-center bg-black h-[calc(100vh-4rem)]">
				<div className="flex flex-col items-center gap-3">
					<RefreshCw className="w-8 h-8 text-white animate-spin" />
					<span className="text-sm font-semibold text-neutral-400 animate-pulse">Loading site visit details...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-black overflow-hidden animate-in fade-in duration-300 w-full text-neutral-100">
			{/* Project Workspace header */}
			<ProjectTopbar
				projectName={formValues.projectName}
				currentStage={1}
				saving={isAutoSaving}
				savingStatus="Auto-saving changes"
			/>

			{/* Main Split Layout Pane */}
			<div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
				
				{/* LEFT PANE: High-Fidelity Capture View (Renders actual snapshot if uploaded) */}
				<div className="w-full lg:w-[45%] bg-black flex-shrink-0 border-r border-white/10 p-6 flex flex-col gap-4 relative overflow-hidden">

					{/* Image or Mock Rooftop Panel projection visualizer */}
					<div className="flex-grow flex items-center justify-center overflow-hidden py-2">
						<div className="w-full aspect-square bg-black rounded-2xl relative overflow-hidden border border-white/10 shadow-inner flex items-center justify-center">
							<img src={metadata.imageLink} alt="Captured Site View" className="w-full h-full object-cover" />
						</div>
					</div>

					{/* Solar Irradiance & Peak Solar Hours Readout */}
					{(metadata.irradiance !== null || metadata.peakHours !== null) && (
						<div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-around flex-shrink-0 shadow-lg">
							{metadata.irradiance !== null && (
								<div className="flex flex-col items-center gap-1 text-center">
									<span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
										Solar Irradiance
									</span>
									<span className="text-sm font-bold text-white">
										{metadata.irradiance.toFixed(2)} kWh/m²/day
									</span>
								</div>
							)}
							{metadata.irradiance !== null && metadata.peakHours !== null && (
								<div className="h-8 w-[1px] bg-white/10" />
							)}
							{metadata.peakHours !== null && (
								<div className="flex flex-col items-center gap-1 text-center">
									<span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
										Peak Sun Hours
									</span>
									<span className="text-sm font-bold text-white">
										{metadata.peakHours.toFixed(2)} hrs/day
									</span>
								</div>
							)}
						</div>
					)}
				</div>

				{/* RIGHT PANE: Intake Data Fields Form */}
				<div className="flex-grow bg-black flex flex-col overflow-hidden relative">
					
					{/* Scrollable Form Body container */}
					<div className="flex-grow overflow-y-auto p-6 md:p-8">
						<div className="max-w-3xl mx-auto flex flex-col gap-6">
							
							{/* Component Section 1: Customer Profile Details */}
							<div className="bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col gap-5 shadow">
								<div className="flex items-center gap-2 border-b border-white/10 pb-3 flex-shrink-0">
									<Briefcase className="w-4 h-4 text-white" />
									<h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
										Customer Info
									</h3>
								</div>

								<div className="flex flex-col gap-4">
									{/* 1. Project Name */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Project Name <span className="text-rose-500">*</span></label>
										<input
											type="text"
											value={formValues.projectName}
											onChange={(e) => updateField("projectName", e.target.value)}
											className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
										/>
									</div>

									{/* 2 & 3. First and Last Name side-by-side */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Customer's First Name <span className="text-rose-500">*</span></label>
											<input
												type="text"
												value={formValues.firstName}
												onChange={(e) => updateField("firstName", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Customer's Last Name <span className="text-rose-500">*</span></label>
											<input
												type="text"
												value={formValues.lastName}
												onChange={(e) => updateField("lastName", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
									</div>

									{/* Phone Number */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Phone Number <span className="text-rose-500">*</span></label>
										<input
											type="tel"
											value={formValues.phone}
											onChange={(e) => updateField("phone", e.target.value)}
											className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
										/>
									</div>
								</div>
							</div>

							{/* Component Section 2: Address Details */}
							<div className="bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col gap-5 shadow">
								<div className="flex items-center gap-2 border-b border-white/10 pb-3 flex-shrink-0">
									<HomeIcon className="w-4 h-4 text-white" />
									<h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
										Installation Address
									</h3>
								</div>

								<div className="flex flex-col gap-4">
									{/* 1. Address Line 1 */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Address Line 1 <span className="text-rose-500">*</span></label>
										<input
											type="text"
											value={formValues.line1}
											onChange={(e) => updateField("line1", e.target.value)}
											className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
										/>
									</div>

									{/* 2. Address Line 2 */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Address Line 2</label>
										<input
											type="text"
											value={formValues.line2}
											onChange={(e) => updateField("line2", e.target.value)}
											className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
										/>
									</div>

									{/* 3 & 4. State & PIN Code */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">State <span className="text-rose-500">*</span></label>
											<select
												value={formValues.state}
												onChange={(e) => {
													updateField("state", e.target.value);
													updateField("discom", "");
												}}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="" className="bg-black text-white">-- Choose State --</option>
												{Object.keys(STATE_DISCOM_MAP).map((s) => (
													<option key={s} value={s} className="bg-black text-white">{s}</option>
												))}
											</select>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">PIN Code <span className="text-rose-500">*</span></label>
											<input
												type="text"
												value={formValues.pin}
												onChange={(e) => updateField("pin", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Component Section 3: Electrical Info */}
							<div className="bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col gap-5 shadow">
								<div className="flex items-center gap-2 border-b border-white/10 pb-3 flex-shrink-0">
									<Zap className="w-4 h-4 text-white" />
									<h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
										Electrical Info
									</h3>
								</div>

								<div className="flex flex-col gap-4">
									{/* 1. DISCOM Utility Provider */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">DISCOM <span className="text-rose-500">*</span></label>
										<select
											value={formValues.discom}
											onChange={(e) => updateField("discom", e.target.value)}
											disabled={!formValues.state}
											className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
										>
											<option value="" className="bg-black text-white">
												{formValues.state ? "-- Select DISCOM provider --" : "-- Select State First --"}
											</option>
											{discomOptions.map((provider) => (
												<option key={provider} value={provider} className="bg-black text-white">{provider}</option>
											))}
										</select>
									</div>

									{/* 2. Category & Location Type */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Connection Type <span className="text-rose-500">*</span></label>
											<select
												value={formValues.type}
												onChange={(e) => updateField("type", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="residential" className="bg-black text-white">Residential</option>
												<option value="commercial" className="bg-black text-white">Commercial</option>
												<option value="utility" className="bg-black text-white">Utility</option>
											</select>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Location Type <span className="text-rose-500">*</span></label>
											<select
												value={formValues.projectType}
												onChange={(e) => updateField("projectType", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="ongrid" className="bg-black text-white">OnGrid</option>
												<option value="offgrid" className="bg-black text-white">OffGrid</option>
												<option value="hybrid" className="bg-black text-white">Hybrid</option>
											</select>
										</div>
									</div>

									{/* 4. Phase & Sanctioned Load */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Phase <span className="text-rose-500">*</span></label>
											<select
												value={formValues.connectionType}
												onChange={(e) => updateField("connectionType", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="single_phase" className="bg-black text-white">Single phase</option>
												<option value="three_phase" className="bg-black text-white">Three phase</option>
											</select>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Sanctioned Load (kW) <span className="text-rose-500">*</span></label>
											<input
												type="number"
												value={formValues.sanctionedLoad}
												onChange={(e) => updateField("sanctionedLoad", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
									</div>

									{/* 5. Avg Monthly Bill & Unit Price */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Average Monthly Bill (₹) <span className="text-rose-500">*</span></label>
											<input
												type="number"
												value={formValues.avgBill}
												onChange={(e) => updateField("avgBill", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
										<div className="flex flex-col gap-1.5 justify-center">
											<div className="flex justify-between items-center">
												<label className="text-xs font-bold text-neutral-400">Unit Price <span className="text-rose-500">*</span></label>
												<span className="text-xs font-extrabold text-white">₹{formValues.unitPrice || "7.0"} / unit</span>
											</div>
											<input
												type="range"
												min="1"
												max="15"
												step="0.5"
												value={formValues.unitPrice || "7"}
												onChange={(e) => updateField("unitPrice", e.target.value)}
												className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white mt-3"
											/>
										</div>
									</div>
								</div>
							</div>

						</div>
					</div>

					{/* Action Buttons bar bottom */}
					<div className="bg-black border-t border-white/10 px-8 py-4 flex-shrink-0 flex items-center justify-end gap-3.5 z-10">
						<button
							onClick={() => navigate("/")}
							className="px-5 py-3 border border-white/20 hover:bg-white/10 text-neutral-450 hover:text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
						>
							Cancel
						</button>
						<button
							onClick={handleNextStep}
							disabled={saving}
							className="px-8 py-3 bg-white hover:bg-neutral-200 text-black text-sm font-bold rounded-xl shadow transition-all cursor-pointer flex items-center gap-2 border border-transparent"
						>
							{saving ? (
								<>
									<RefreshCw className="w-3.5 h-3.5 animate-spin" />
									<span>Confirming...</span>
								</>
							) : (
								<>
									<span>Confirm & Proceed</span>
									<ChevronRight className="w-4 h-4 text-black" />
								</>
							)}
						</button>
					</div>

				</div>

			</div>
		</div>
	);
}
