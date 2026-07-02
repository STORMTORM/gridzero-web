import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Search,
	ChevronRight,
	Zap,
	Briefcase,
	Home as HomeIcon,
	MapPin,
	RefreshCw,
} from "lucide-react";
import api from "../../api/client";

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
	const [loadingData, setLoadingData] = useState(true);
	const [saving, setSaving] = useState(false);

	const searchInputRef = useRef<HTMLInputElement>(null);

	const [currentAddress, setCurrentAddress] = useState("Captured Map Location");
	const [imageLink, setImageLink] = useState<string | null>(null);

	// Customer details form values state
	const [formValues, setFormValues] = useState({
		projectName: "",
		firstName: "",
		lastName: "",
		phone: "",
		email: "",
		line1: "",
		line2: "",
		state: "",
		pin: "",
		discom: "",
		type: "",
		connectionType: "",
		projectType: "",
		mountingType: "",
		capexOpex: "",
		sanctionedLoad: "",
		avgBill: "",
		unitPrice: "",
	});

	// Dynamic DISCOM choices based on state selection
	const discomOptions = useMemo(() => {
		return STATE_DISCOM_MAP[formValues.state] ?? [];
	}, [formValues.state]);

	const updateField = (field: keyof typeof formValues, value: string) => {
		setFormValues((prev) => ({ ...prev, [field]: value }));
	};

	// Debounced Auto-save Form Updates to Live Backend
	const isFirstRender = useRef(true);
	useEffect(() => {
		if (isFirstRender.current || !id) {
			isFirstRender.current = false;
			return;
		}

		const delayDebounceFn = setTimeout(async () => {
			try {
				await api.post("/visit/map/save", {
					sitevisit_id: id,
					project_name: formValues.projectName,
					first_name: formValues.firstName,
					last_name: formValues.lastName,
					phone_number: formValues.phone,
					line1: formValues.line1,
					line2: formValues.line2,
					pin: formValues.pin,
					state: formValues.state,
					discom: formValues.discom,
					type: formValues.type,
					connection_type: formValues.connectionType,
					project_type: formValues.projectType,
					mounting_type: formValues.mountingType,
					capex_opex: formValues.capexOpex,
					sanctioned_load: formValues.sanctionedLoad ? Number(formValues.sanctionedLoad) : null,
					avg_bill: formValues.avgBill ? Number(formValues.avgBill) : null,
					unit_price: formValues.unitPrice ? Number(formValues.unitPrice) : null,
				});

				// Also sync back with dashboard list if local mock entries exist
				const storedProjects = localStorage.getItem("mock_projects");
				if (storedProjects) {
					const list = JSON.parse(storedProjects);
					const idx = list.findIndex((p: any) => p.id === id);
					if (idx !== -1) {
						list[idx].name = formValues.projectName;
						list[idx].customer = `${formValues.firstName} ${formValues.lastName}`.trim();
						list[idx].address = formValues.line1;
						if (formValues.sanctionedLoad) {
							list[idx].capacity = `${parseFloat(formValues.sanctionedLoad).toFixed(1)} kWp`;
							list[idx].panels = Math.round(parseFloat(formValues.sanctionedLoad) * 2);
						}
						localStorage.setItem("mock_projects", JSON.stringify(list));
					}
				}
				console.log("Customer Intake auto-saved to backend successfully");
			} catch (e) {
				console.error("Auto-save failed", e);
			}
		}, 1500);

		return () => clearTimeout(delayDebounceFn);
	}, [formValues, id]);

	// Fetch existing project details on mount from Live Backend
	useEffect(() => {
		if (!id) return;

		const loadProjectDetails = async () => {
			try {
				setLoadingData(true);
				const res = await api.get(`/visit/map/${id}`);
				const data = res.data;
				
				const addr = data.address || {};
				const d = data.map_details || {};

				setFormValues({
					projectName: d.project_name || "",
					firstName: addr.first_name || "",
					lastName: addr.last_name || "",
					phone: addr.phone ? String(addr.phone) : "",
					email: addr.email || "",
					line1: addr.line1 || "",
					line2: addr.line2 || "",
					state: addr.state || "",
					pin: addr.pin ? String(addr.pin) : "",
					discom: d.discom || "",
					type: d.type || "",
					connectionType: d.connection_type || "",
					projectType: d.project_type || "",
					mountingType: d.mounting_type || "",
					capexOpex: d.capex_opex || "",
					sanctionedLoad: d.sanctioned_load != null ? String(d.sanctioned_load) : "",
					avgBill: d.avg_bill != null ? String(d.avg_bill) : "",
					unitPrice: d.unit_price != null ? String(d.unit_price) : "",
				});

				if (data.image_link) {
					setImageLink(data.image_link);
				}
				setCurrentAddress(addr.line1 || "Captured Map Location");
			} catch (e) {
				console.error("Failed to load project details from backend", e);
			} finally {
				setLoadingData(false);
			}
		};

		loadProjectDetails();
	}, [id]);

	const handleNextStep = async () => {
		setSaving(true);
		try {
			await api.post("/visit/map/save", {
				sitevisit_id: id,
				project_name: formValues.projectName,
				first_name: formValues.firstName,
				last_name: formValues.lastName,
				phone_number: formValues.phone,
				line1: formValues.line1,
				line2: formValues.line2,
				pin: formValues.pin,
				state: formValues.state,
				discom: formValues.discom,
				type: formValues.type,
				connection_type: formValues.connectionType,
				project_type: formValues.projectType,
				mounting_type: formValues.mountingType,
				capex_opex: formValues.capexOpex,
				sanctioned_load: formValues.sanctionedLoad ? Number(formValues.sanctionedLoad) : null,
				avg_bill: formValues.avgBill ? Number(formValues.avgBill) : null,
				unit_price: formValues.unitPrice ? Number(formValues.unitPrice) : null,
				finalize: true,
			});

			// Sync final row status on dashboard table list
			const storedProjects = localStorage.getItem("mock_projects");
			if (storedProjects) {
				const list = JSON.parse(storedProjects);
				const idx = list.findIndex((p: any) => p.id === id);
				if (idx !== -1) {
					list[idx].status = "Proposal Draft";
					localStorage.setItem("mock_projects", JSON.stringify(list));
				}
			}
			navigate("/");
		} catch (e) {
			console.error("Failed to finalize details", e);
		} finally {
			setSaving(false);
		}
	};

	if (loadingData) {
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
			{/* Page Onboarding Title header */}
			<div className="bg-black border-b border-white/10 px-6 py-4 flex-shrink-0 flex items-center justify-between">
				<div className="flex items-center gap-2.5 text-xs font-semibold text-neutral-400">
					<span className="text-neutral-500">Workspace</span>
					<ChevronRight className="w-3 h-3 text-neutral-600" />
					<span className="font-bold text-white">{formValues.projectName || "Solar Site Project"}</span>
					<ChevronRight className="w-3 h-3 text-neutral-600" />
					<span className="text-white bg-white/10 px-2.5 py-0.5 rounded border border-white/10 font-bold uppercase tracking-wider">
						Customer Intake
					</span>
				</div>
				<div className="text-xs text-neutral-500 font-semibold italic flex items-center gap-1.5">
					<div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
					<span>Auto-saving changes</span>
				</div>
			</div>

			{/* Main Split Layout Pane */}
			<div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
				
				{/* LEFT PANE: High-Fidelity Capture View (Renders actual snapshot if uploaded) */}
				<div className="w-full lg:w-[45%] bg-black flex-shrink-0 border-r border-white/10 p-6 flex flex-col gap-4 relative overflow-hidden">
					
					{/* Search Box mock overlay */}
					<div className="z-10 flex gap-2">
						<div className="flex-grow flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl shadow-lg">
							<Search className="w-3.5 h-3.5 text-neutral-500" />
							<input
								ref={searchInputRef}
								type="text"
								value={formValues.line1}
								onChange={(e) => updateField("line1", e.target.value)}
								placeholder="Building address location..."
								className="w-full text-xs font-bold text-white placeholder-neutral-600 bg-transparent focus:outline-none"
							/>
						</div>
					</div>

					{/* Image or Mock Rooftop Panel projection visualizer */}
					<div className="flex-grow flex items-center justify-center overflow-hidden py-2">
						<div className="w-full aspect-square bg-black rounded-2xl relative overflow-hidden border border-white/10 shadow-inner flex items-center justify-center">
							
							{imageLink ? (
								<img src={imageLink} alt="Captured Site View" className="w-full h-full object-cover" />
							) : (
								<>
									{/* Grid pattern background */}
									<div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

									{/* Mock satellite image shape */}
									<div className="w-[85%] aspect-square rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative">
										
										{/* Roof schematic outline using SVG */}
										<svg className="w-[70%] h-[70%] text-neutral-800 opacity-60" viewBox="0 0 100 100">
											<polygon points="15,15 85,15 85,85 15,85" fill="none" stroke="currentColor" strokeWidth="1.5" />
											<line x1="15" y1="15" x2="50" y2="50" stroke="currentColor" strokeWidth="1" />
											<line x1="85" y1="15" x2="50" y2="50" stroke="currentColor" strokeWidth="1" />
											<line x1="85" y1="85" x2="50" y2="50" stroke="currentColor" strokeWidth="1" />
											<line x1="15" y1="85" x2="50" y2="50" stroke="currentColor" strokeWidth="1" />
											
											<rect x="25" y="25" width="20" height="15" rx="1" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeWidth="1" />
											<rect x="52" y="25" width="20" height="15" rx="1" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeWidth="1" />
											<rect x="25" y="55" width="20" height="15" rx="1" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeWidth="1" />
											<rect x="52" y="55" width="20" height="15" rx="1" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeWidth="1" />
										</svg>

										{/* Blueprint overlay labels */}
										<div className="absolute top-8 left-8 text-[9px] font-bold text-white bg-white/10 px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">
											Area A: 24 modules
										</div>
										<div className="absolute bottom-8 right-8 text-[9px] font-bold text-white bg-white/10 px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">
											Azimuth: 180° (S)
										</div>
									</div>
								</>
							)}

							{/* Fixed Center Pin Target Crosshair */}
							<div className="absolute top-1/2 left-1/2 pointer-events-none z-20 flex flex-col items-center justify-center">
								<div className="w-1.5 h-1.5 bg-white rounded-full shadow shadow-white/85" />
								<div className="w-10 h-[1px] bg-white/40 absolute" />
								<div className="h-10 w-[1px] bg-white/40 absolute" />
							</div>

							{/* Bottom location readouts */}
							<div className="absolute bottom-4 left-4 right-4 bg-white/10 border border-white/10 rounded-xl p-3 flex flex-col gap-1 shadow-2xl">
								<span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
									Intake Site Coordinate Capture
								</span>
								<div className="flex items-center gap-1.5 text-white text-xs font-bold mt-0.5">
									<MapPin className="w-3.5 h-3.5 text-white flex-shrink-0" />
									<span className="truncate">{currentAddress}</span>
								</div>
							</div>
						</div>
					</div>
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
										Customer Profile
									</h3>
								</div>

								<div className="flex flex-col gap-4">
									{/* 1. Project Name */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Project Reference Name <span className="text-rose-500">*</span></label>
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
											<label className="text-xs font-bold text-neutral-400">Customer First Name <span className="text-rose-500">*</span></label>
											<input
												type="text"
												value={formValues.firstName}
												onChange={(e) => updateField("firstName", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Customer Last Name <span className="text-rose-500">*</span></label>
											<input
												type="text"
												value={formValues.lastName}
												onChange={(e) => updateField("lastName", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
									</div>

									{/* 4 & 5. Phone and Email side-by-side */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Phone Number <span className="text-rose-500">*</span></label>
											<input
												type="tel"
												value={formValues.phone}
												onChange={(e) => updateField("phone", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Email Address <span className="text-rose-500">*</span></label>
											<input
												type="email"
												value={formValues.email}
												onChange={(e) => updateField("email", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
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
										<label className="text-xs font-bold text-neutral-400">Street Line 1 <span className="text-rose-500">*</span></label>
										<input
											type="text"
											value={formValues.line1}
											onChange={(e) => updateField("line1", e.target.value)}
											className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
										/>
									</div>

									{/* 2. Address Line 2 */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Street Line 2</label>
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

							{/* Component Section 3: Utility Tariff Info */}
							<div className="bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col gap-5 shadow">
								<div className="flex items-center gap-2 border-b border-white/10 pb-3 flex-shrink-0">
									<Zap className="w-4 h-4 text-white" />
									<h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
										Utility & Tariff Details
									</h3>
								</div>

								<div className="flex flex-col gap-4">
									{/* 1. DISCOM Utility Provider */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-neutral-400">Electricity Utility Provider (DISCOM) <span className="text-rose-500">*</span></label>
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

									{/* 2 & 3. Connection and Project Type */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Connection Category <span className="text-rose-500">*</span></label>
											<select
												value={formValues.type}
												onChange={(e) => updateField("type", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="" className="bg-black text-white">-- Choose Category --</option>
												<option value="Residential" className="bg-black text-white">Residential</option>
												<option value="Commercial" className="bg-black text-white">Commercial</option>
												<option value="Industrial" className="bg-black text-white">Industrial</option>
												<option value="Institutional" className="bg-black text-white">Institutional</option>
											</select>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Connection Phase Configuration <span className="text-rose-500">*</span></label>
											<select
												value={formValues.connectionType}
												onChange={(e) => updateField("connectionType", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="" className="bg-black text-white">-- Choose Phase --</option>
												<option value="1-Phase" className="bg-black text-white">1-Phase Connection</option>
												<option value="3-Phase" className="bg-black text-white">3-Phase Connection</option>
												<option value="HT Connection" className="bg-black text-white">High Tension (HT)</option>
											</select>
										</div>
									</div>

									{/* 4. Mounting & Capex Options */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Structure Mounting Type <span className="text-rose-500">*</span></label>
											<select
												value={formValues.mountingType}
												onChange={(e) => updateField("mountingType", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="" className="bg-black text-white">-- Choose Mounting --</option>
												<option value="Flush Mount" className="bg-black text-white">Flush Mount (Roof Parallel)</option>
												<option value="Elevated Structure" className="bg-black text-white">Elevated Structure</option>
												<option value="Ballasted Mount" className="bg-black text-white">Ballasted / Non-penetrative</option>
												<option value="Ground Mount" className="bg-black text-white">Ground Mount</option>
											</select>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Financial Model <span className="text-rose-500">*</span></label>
											<select
												value={formValues.capexOpex}
												onChange={(e) => updateField("capexOpex", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/10 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all cursor-pointer"
											>
												<option value="" className="bg-black text-white">-- Choose Model --</option>
												<option value="CAPEX" className="bg-black text-white">CAPEX (Customer Owned)</option>
												<option value="OPEX" className="bg-black text-white">RESCO / OPEX (Power Agreement)</option>
												<option value="EMI" className="bg-black text-white">Solar Finance Loan (EMI)</option>
											</select>
										</div>
									</div>

									{/* 5 & 6. Sanctioned Load and Average Monthly Electricity Bill side-by-side */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Sanctioned Load (kW) <span className="text-rose-500">*</span></label>
											<input
												type="number"
												value={formValues.sanctionedLoad}
												onChange={(e) => updateField("sanctionedLoad", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-neutral-400">Avg Monthly Bill (₹) <span className="text-rose-500">*</span></label>
											<input
												type="number"
												value={formValues.avgBill}
												onChange={(e) => updateField("avgBill", e.target.value)}
												className="w-full text-xs font-bold text-white bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
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
							className="px-5 py-3 border border-white/20 hover:bg-white/10 text-neutral-450 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
						>
							Cancel
						</button>
						<button
							onClick={handleNextStep}
							disabled={saving}
							className="px-8 py-3 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-xl shadow transition-all cursor-pointer flex items-center gap-2 border border-transparent"
						>
							{saving ? (
								<>
									<RefreshCw className="w-3.5 h-3.5 animate-spin" />
									<span>Finalizing...</span>
								</>
							) : (
								<>
									<span>Finalize & Proceed</span>
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
