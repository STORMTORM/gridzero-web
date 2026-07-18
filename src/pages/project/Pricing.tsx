import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	RefreshCw,
	ChevronRight,
	IndianRupee,
	Plus,
	Trash2,
	AlertCircle,
	Check,
	Bookmark,
} from "lucide-react";
import * as siteVisitApi from "../../api/siteVisitApi";
import ProjectTopbar from "../../components/ProjectTopbar";

interface PaymentTerm {
	heading: string;
	percentage: number | null;
}

interface AdditionalCostItem {
	description: string;
	amount: string;
}

export default function Pricing() {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isAutoSaving, setIsAutoSaving] = useState(false);
	const [settingDefaultPt, setSettingDefaultPt] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Holds the raw proposal payload to avoid losing properties on save
	const [proposalData, setProposalData] = useState<any>(null);

	// Local states for calculations and UI rendering
	const [gstIncluded, setGstIncluded] = useState(false);
	const [systemCost, setSystemCost] = useState("");
	const [discountEnabled, setDiscountEnabled] = useState(false);
	const [discountPct, setDiscountPct] = useState("0");
	const [gstPct, setGstPct] = useState("8.9");
	const [subsidyEnabled, setSubsidyEnabled] = useState(false);
	const [subsidy, setSubsidy] = useState("0");
	const [additionalCostEnabled, setAdditionalCostEnabled] = useState(false);
	const [additionalCostItems, setAdditionalCostItems] = useState<AdditionalCostItem[]>([]);
	const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);

	// Read-only info from API to show in sidebar summaries
	const [projectName, setProjectName] = useState("");
	const [dcCapacity, setDcCapacity] = useState(0);

	// Load existing proposal details
	useEffect(() => {
		if (!id) return;
		const loadProposalData = async () => {
			try {
				setLoading(true);
				const r = await siteVisitApi.getProposal(id);
				setProposalData(r);

				setProjectName(r.project_name || `Project ${id}`);
				setDcCapacity(r.dc_capacity_kw || 0);

				setGstIncluded(!!r.gst_included);
				setSystemCost(r.system_cost != null ? String(r.system_cost) : "");
				setDiscountEnabled(!!r.discount_enabled);
				setDiscountPct(r.discount_pct != null ? String(r.discount_pct) : "0");
				setGstPct(r.gst_pct != null ? String(r.gst_pct) : "8.9");
				setSubsidyEnabled(!!r.subsidy_enabled);
				setSubsidy(r.subsidy != null ? String(r.subsidy) : "0");
				setAdditionalCostEnabled(!!r.additional_cost_enabled);
				
				const items = Array.isArray(r.additional_cost_items) ? r.additional_cost_items : [];
				setAdditionalCostItems(items.map((it: any) => ({
					description: it.description || "",
					amount: it.amount != null ? String(it.amount) : ""
				})));

				const payTerms = Array.isArray(r.payment_terms) ? r.payment_terms : [];
				setPaymentTerms(payTerms.map((t: any) => ({
					heading: t.heading || "",
					percentage: t.percentage != null ? Number(t.percentage) : null
				})));

			} catch (err) {
				console.error("Failed to load proposal pricing details", err);
				setError("Could not retrieve pricing configuration.");
			} finally {
				setLoading(false);
			}
		};
		loadProposalData();
	}, [id]);

	// Build saving payload
	const buildPayload = () => {
		if (!proposalData) return {};
		return {
			...proposalData,
			sitevisit_id: id,
			system_cost: systemCost ? parseFloat(systemCost) : null,
			discount_pct: discountPct ? parseFloat(discountPct) : 0,
			gst_pct: gstPct ? parseFloat(gstPct) : 8.9,
			subsidy: subsidy ? parseFloat(subsidy) : 0,
			discount_enabled: !!discountEnabled,
			subsidy_enabled: !!subsidyEnabled,
			gst_included: !!gstIncluded,
			additional_cost_enabled: !!additionalCostEnabled,
			additional_cost_items: additionalCostEnabled
				? additionalCostItems
						.map((it) => ({
							description: (it.description || "").trim(),
							amount: it.amount ? parseFloat(it.amount) : 0,
						}))
						.filter((it) => it.description || (it.amount && it.amount > 0))
				: [],
			payment_terms: paymentTerms,
		};
	};

	// Debounced Auto-save
	const isFirstRender = useRef(true);
	useEffect(() => {
		if (isFirstRender.current || !proposalData) {
			isFirstRender.current = false;
			return;
		}
		setIsAutoSaving(true);
		const saveDebounce = setTimeout(async () => {
			try {
				await siteVisitApi.saveProposal(buildPayload());
				console.log("Proposal pricing auto-saved successfully");
			} catch (e) {
				console.error("Auto-save pricing failed", e);
			} finally {
				setIsAutoSaving(false);
			}
		}, 1500);

		return () => clearTimeout(saveDebounce);
	}, [
		systemCost,
		gstIncluded,
		discountEnabled,
		discountPct,
		gstPct,
		subsidyEnabled,
		subsidy,
		additionalCostEnabled,
		additionalCostItems,
		paymentTerms,
		proposalData
	]);

	// Compute Pricing Math
	const pricingResult = useMemo(() => {
		const cost = Math.max(0, parseFloat(systemCost) || 0);
		const discPct = discountEnabled ? Math.max(0, parseFloat(discountPct) || 0) : 0;
		const discountAmount = cost * (discPct / 100);
		const afterDiscount = cost - discountAmount;

		const taxPct = parseFloat(gstPct) || 0;
		const gstAmount = gstIncluded ? 0 : afterDiscount * (taxPct / 100);
		const totalPayable = afterDiscount + gstAmount;

		const subAmount = subsidyEnabled ? Math.max(0, parseFloat(subsidy) || 0) : 0;
		const additionalAmount = additionalCostEnabled
			? additionalCostItems.reduce((sum, item) => sum + Math.max(0, parseFloat(item.amount) || 0), 0)
			: 0;

		const effectiveCost = Math.max(0, totalPayable - subAmount + additionalAmount);

		return {
			baseCost: cost,
			discountAmount,
			afterDiscount,
			gstAmount,
			totalPayable,
			subAmount,
			additionalAmount,
			effectiveCost,
		};
	}, [systemCost, gstIncluded, discountEnabled, discountPct, gstPct, subsidyEnabled, subsidy, additionalCostEnabled, additionalCostItems]);

	// Save Payment Terms default to profile API
	const handleSetPtDefault = async () => {
		setSettingDefaultPt(true);
		try {
			await siteVisitApi.updateProfile({ payment_terms: paymentTerms });
			console.log("Default payment terms saved.");
		} catch (err) {
			console.error("Failed to save default payment terms", err);
		} finally {
			setSettingDefaultPt(false);
		}
	};

	// Milestones validation check
	const milestoneMath = useMemo(() => {
		const termsWithPct = paymentTerms.filter((t) => t.percentage != null);
		const sum = termsWithPct.reduce((acc, t) => acc + (t.percentage || 0), 0);
		const isValid = paymentTerms.length === 0 || Math.abs(sum - 100) <= 0.01;
		return { sum, isValid };
	}, [paymentTerms]);

	const handleNextStep = async () => {
		if (!milestoneMath.isValid) {
			setError("Payment terms milestones must sum up to exactly 100%.");
			return;
		}
		setSaving(true);
		try {
			await siteVisitApi.saveProposal({
				...buildPayload(),
				finalize: true,
			});
			// Navigate to final proposal preview step
			navigate(`/project/${id}/details`); // Or wherever stage 8 details are final!
		} catch (err) {
			console.error(err);
			setError("Failed to save pricing configuration.");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex-grow flex items-center justify-center bg-background h-screen w-screen">
				<div className="flex flex-col items-center gap-3">
					<RefreshCw className="w-8 h-8 text-primary animate-spin" />
					<span className="text-sm font-semibold text-placeholder animate-pulse">Loading Pricing Cockpit...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen w-screen bg-background overflow-hidden text-text font-sans select-none">
			
			<ProjectTopbar
				projectName={projectName}
				currentStage={7}
				saving={isAutoSaving}
				savingStatus="Auto-saving pricing"
			/>

			{/* Main content split viewport panels */}
			<div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
				
				{/* LEFT COLUMN: Financial Readout and segment charts */}
				<div className="w-full lg:w-[45%] bg-background flex-shrink-0 border-r border-border p-8 flex flex-col justify-between overflow-y-auto">
					<div className="flex flex-col gap-6">
						<div>
							<span className="text-[10px] font-bold text-placeholder uppercase tracking-widest">Pricing Model Summary</span>
							<h3 className="text-lg font-extrabold text-text mt-1">Financial Analysis Projections</h3>
						</div>

						{/* Breakdown breakdown details card */}
						<div className="bg-card/60 border border-border rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
							<div className="flex justify-between items-center border-b border-border pb-3">
								<span className="text-xs font-bold text-placeholder">Total System Capacity</span>
								<span className="text-sm font-extrabold text-text">{dcCapacity.toFixed(2)} kWp</span>
							</div>

							<div className="flex flex-col gap-3.5 mt-1">
								{/* System Gross Price */}
								<div className="flex justify-between items-center">
									<span className="text-xs text-placeholder">Gross System Cost</span>
									<span className="text-xs font-bold text-text">₹ {pricingResult.baseCost.toLocaleString()}</span>
								</div>

								{/* Discount Line */}
								{discountEnabled && pricingResult.discountAmount > 0 && (
									<div className="flex justify-between items-center text-primary">
										<span className="text-xs">Discount ({discountPct}%)</span>
										<span className="text-xs font-bold">- ₹ {pricingResult.discountAmount.toLocaleString()}</span>
									</div>
								)}

								{/* GST Tax Line */}
								{!gstIncluded && pricingResult.gstAmount > 0 && (
									<div className="flex justify-between items-center text-placeholder">
										<span className="text-xs">GST Tax ({gstPct}%)</span>
										<span className="text-xs font-bold">+ ₹ {pricingResult.gstAmount.toLocaleString()}</span>
									</div>
								)}

								{/* Gross Total Payable */}
								<div className="flex justify-between items-center border-t border-border pt-3.5">
									<span className="text-xs font-bold text-placeholder">Total System Price (incl. GST)</span>
									<span className="text-xs font-bold text-text">₹ {pricingResult.totalPayable.toLocaleString()}</span>
								</div>

								{/* Subsidy rebate line */}
								{subsidyEnabled && pricingResult.subAmount > 0 && (
									<div className="flex justify-between items-center text-primary">
										<span className="text-xs">Government Subsidy</span>
										<span className="text-xs font-bold">- ₹ {pricingResult.subAmount.toLocaleString()}</span>
									</div>
								)}

								{/* Additional custom charges line */}
								{additionalCostEnabled && pricingResult.additionalAmount > 0 && (
									<div className="flex justify-between items-center text-amber-500">
										<span className="text-xs">Additional Infrastructure Costs</span>
										<span className="text-xs font-bold">+ ₹ {pricingResult.additionalAmount.toLocaleString()}</span>
									</div>
								)}
							</div>

							{/* Cost incurred summary badge */}
							<div className="mt-4 bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col gap-1 items-center text-center">
								<span className="text-[10px] font-bold text-primary uppercase tracking-widest">Effective Cost to Customer</span>
								<span className="text-xl font-black text-text">
									₹ {pricingResult.effectiveCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
								</span>
							</div>
						</div>

						{/* Premium visual distribution segment bar */}
						{pricingResult.baseCost > 0 && (
							<div className="flex flex-col gap-2 mt-2">
								<span className="text-[9px] font-bold text-placeholder uppercase tracking-wider">Cost Segment Share</span>
								<div className="h-2.5 w-full bg-background rounded-full overflow-hidden flex">
									<div 
										style={{ width: `${(pricingResult.afterDiscount / pricingResult.effectiveCost) * 100}%` }}
										className="h-full bg-text/70"
										title="Base Cost"
									/>
									{!gstIncluded && pricingResult.gstAmount > 0 && (
										<div 
											style={{ width: `${(pricingResult.gstAmount / pricingResult.effectiveCost) * 100}%` }}
											className="h-full bg-blue-500"
											title="GST"
										/>
									)}
									{additionalCostEnabled && pricingResult.additionalAmount > 0 && (
										<div 
											style={{ width: `${(pricingResult.additionalAmount / pricingResult.effectiveCost) * 100}%` }}
											className="h-full bg-amber-500"
											title="Additional Costs"
										/>
									)}
								</div>
								<div className="flex gap-4 mt-1">
									<div className="flex items-center gap-1.5 text-[9px] font-bold text-placeholder uppercase">
										<div className="w-2 h-2 rounded-full bg-text/70" />
										<span>Base</span>
									</div>
									{!gstIncluded && pricingResult.gstAmount > 0 && (
										<div className="flex items-center gap-1.5 text-[9px] font-bold text-placeholder uppercase">
											<div className="w-2 h-2 rounded-full bg-blue-500" />
											<span>Tax</span>
										</div>
									)}
									{additionalCostEnabled && pricingResult.additionalAmount > 0 && (
										<div className="flex items-center gap-1.5 text-[9px] font-bold text-placeholder uppercase">
											<div className="w-2 h-2 rounded-full bg-amber-500" />
											<span>Extras</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="text-[10px] text-placeholder leading-normal max-w-sm mt-8 border-t border-border pt-4">
						All estimations, calculations, and tax lines are live compiled and sync immediately to generate the final proposal package.
					</div>
				</div>

				{/* RIGHT COLUMN: Config options and forms panel */}
				<div className="flex-grow flex flex-col overflow-hidden relative bg-background/20">
					
					{/* Scrollable form area */}
					<div className="flex-grow overflow-y-auto p-8">
						<div className="max-w-2xl mx-auto flex flex-col gap-6">
							{error && (
								<div className="bg-red-500/10 border border-red-500/15 rounded-xl p-3 flex items-start gap-2 text-[10px] font-bold text-red-400 leading-relaxed">
									<AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
									<span>{error}</span>
								</div>
							)}

							{/* Segment 1: Base Costs Configuration */}
							<div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-5 shadow">
								<h3 className="text-xs font-extrabold text-text uppercase tracking-wider border-b border-border pb-3">
									Base Pricing Setup
								</h3>

								<div className="flex flex-col gap-4">
									{/* GST Included in system cost toggle */}
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold text-placeholder">GST Included in System Cost</span>
										<div className="flex bg-background border border-border rounded-xl p-0.5">
											<button
												onClick={() => setGstIncluded(false)}
												className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
													!gstIncluded ? "bg-primary text-white" : "text-placeholder"
												}`}
											>
												No
											</button>
											<button
												onClick={() => setGstIncluded(true)}
												className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
													gstIncluded ? "bg-primary text-white" : "text-placeholder"
												}`}
											>
												Yes
											</button>
										</div>
									</div>

									{/* System Cost gross */}
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-placeholder flex items-center justify-between">
											<span>System Cost <span className="text-rose-500">*</span></span>
										</label>
										<div className="relative">
											<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
												<IndianRupee className="w-3.5 h-3.5 text-placeholder" />
											</div>
											<input
												type="number"
												value={systemCost}
												onChange={(e) => setSystemCost(e.target.value)}
												placeholder="0"
												className="w-full text-xs font-bold text-text bg-background border border-border pl-9 pr-3 py-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
											/>
										</div>
									</div>

									{/* GST Percentage */}
									{!gstIncluded && (
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-bold text-placeholder">GST Percentage (%)</label>
											<input
												type="number"
												step="0.1"
												value={gstPct}
												onChange={(e) => setGstPct(e.target.value)}
												className="w-full text-xs font-bold text-text bg-background border border-border p-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
											/>
										</div>
									)}
								</div>
							</div>

							{/* Segment 2: Discount & Subsidy settings */}
							<div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-5 shadow">
								<h3 className="text-xs font-extrabold text-text uppercase tracking-wider border-b border-border pb-3">
									Discounts & Rebates
								</h3>

								<div className="flex flex-col gap-5">
									{/* Discount toggle */}
									<div className="flex flex-col gap-2">
										<div className="flex items-center justify-between">
											<span className="text-xs font-bold text-placeholder">Apply System Discount</span>
											<div className="flex bg-background border border-border rounded-xl p-0.5">
												<button
													onClick={() => setDiscountEnabled(false)}
													className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
														!discountEnabled ? "bg-primary text-white" : "text-placeholder"
													}`}
												>
													No
												</button>
												<button
													onClick={() => setDiscountEnabled(true)}
													className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
														discountEnabled ? "bg-primary text-white" : "text-placeholder"
													}`}
												>
													Yes
												</button>
											</div>
										</div>
										{discountEnabled && (
											<div className="flex flex-col gap-1.5 mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
												<div className="flex justify-between items-center">
													<label className="text-[10px] font-bold text-placeholder">Discount Percentage</label>
													<span className="text-xs font-bold text-text">{discountPct}%</span>
												</div>
												<input
													type="range"
													min="0.1"
													max="99.9"
													step="0.1"
													value={discountPct}
													onChange={(e) => setDiscountPct(e.target.value)}
													className="w-full h-1 bg-background rounded-lg appearance-none cursor-pointer accent-primary mt-1"
												/>
											</div>
										)}
									</div>

									{/* Subsidy toggle */}
									<div className="flex flex-col gap-2 border-t border-border pt-4">
										<div className="flex items-center justify-between">
											<span className="text-xs font-bold text-placeholder">Apply Government Subsidy</span>
											<div className="flex bg-background border border-border rounded-xl p-0.5">
												<button
													onClick={() => setSubsidyEnabled(false)}
													className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
														!subsidyEnabled ? "bg-primary text-white" : "text-placeholder"
													}`}
												>
													No
												</button>
												<button
													onClick={() => {
														setSubsidyEnabled(true);
														if (!subsidy || subsidy === "0") setSubsidy("78000");
													}}
													className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
														subsidyEnabled ? "bg-primary text-white" : "text-placeholder"
													}`}
												>
													Yes
												</button>
											</div>
										</div>
										{subsidyEnabled && (
											<div className="flex flex-col gap-1.5 mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
												<label className="text-[10px] font-bold text-placeholder">Subsidy Rebate Amount (₹)</label>
												<div className="relative">
													<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
														<IndianRupee className="w-3.5 h-3.5 text-placeholder" />
													</div>
													<input
														type="number"
														value={subsidy}
														onChange={(e) => setSubsidy(e.target.value)}
														className="w-full text-xs font-bold text-text bg-background border border-border pl-9 pr-3 py-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
													/>
												</div>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Segment 3: Additional Costs Setup */}
							<div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-5 shadow">
								<h3 className="text-xs font-extrabold text-text uppercase tracking-wider border-b border-border pb-3 flex items-center justify-between">
									<span>Additional Infrastructure Costs</span>
									<div className="flex bg-background border border-border rounded-xl p-0.5 pointer-events-auto">
										<button
											onClick={() => {
												setAdditionalCostEnabled(false);
												setAdditionalCostItems([]);
											}}
											className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
												!additionalCostEnabled ? "bg-primary text-white" : "text-placeholder"
											}`}
										>
											No
										</button>
										<button
											onClick={() => {
												setAdditionalCostEnabled(true);
												if (additionalCostItems.length === 0) {
													setAdditionalCostItems([{ description: "", amount: "" }]);
												}
											}}
											className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
												additionalCostEnabled ? "bg-primary text-white" : "text-placeholder"
											}`}
										>
											Yes
										</button>
									</div>
								</h3>

								{additionalCostEnabled && (
									<div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
										{additionalCostItems.map((item, idx) => (
											<div key={idx} className="flex gap-3 items-center">
												<input
													type="text"
													value={item.description}
													onChange={(e) => {
														const copy = [...additionalCostItems];
														copy[idx].description = e.target.value;
														setAdditionalCostItems(copy);
													}}
													placeholder="Cost description (e.g. Scaffolding)"
													className="flex-grow text-xs font-bold text-text bg-background border border-border p-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
												/>
												<div className="w-[120px] relative">
													<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
														<IndianRupee className="w-3.5 h-3.5 text-placeholder" />
													</div>
													<input
														type="number"
														value={item.amount}
														onChange={(e) => {
															const copy = [...additionalCostItems];
															copy[idx].amount = e.target.value;
															setAdditionalCostItems(copy);
														}}
														placeholder="0"
														className="w-full text-xs font-bold text-text bg-background border border-border pl-9 pr-3 py-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
													/>
												</div>
												<button
													onClick={() => {
														setAdditionalCostItems(additionalCostItems.filter((_, i) => i !== idx));
													}}
													className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer border border-transparent"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</div>
										))}

										{additionalCostItems.length < 4 && (
											<button
												onClick={() => setAdditionalCostItems([...additionalCostItems, { description: "", amount: "" }])}
												className="py-2.5 bg-card hover:bg-background border border-dashed border-border text-text text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-1"
											>
												<Plus className="w-3.5 h-3.5" />
												<span>Add Cost Item</span>
											</button>
										)}
									</div>
								)}
							</div>

							{/* Segment 4: Payment Terms Milestones */}
							<div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-5 shadow">
								<h3 className="text-xs font-extrabold text-text uppercase tracking-wider border-b border-border pb-3 flex items-center justify-between">
									<span>Payment Terms Milestones</span>
									{paymentTerms.length > 0 && (
										<button
											onClick={handleSetPtDefault}
											disabled={settingDefaultPt}
											className="px-2.5 py-1.5 bg-primary text-white hover:opacity-90 disabled:opacity-50 text-[9px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
										>
											<Bookmark className="w-3 h-3" />
											<span>{settingDefaultPt ? "Saving..." : "Set as Default"}</span>
										</button>
									)}
								</h3>

								<div className="flex flex-col gap-4">
									{paymentTerms.map((term, idx) => (
										<div key={idx} className="flex gap-3 items-center">
											<input
												type="text"
												value={term.heading}
												onChange={(e) => {
													const copy = [...paymentTerms];
													copy[idx].heading = e.target.value;
													setPaymentTerms(copy);
												}}
												placeholder="Milestone Heading (e.g. Booking)"
												className="flex-grow text-xs font-bold text-text bg-background border border-border p-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
											/>
											<div className="w-[100px] relative">
												<input
													type="number"
													value={term.percentage !== null ? String(term.percentage) : ""}
													onChange={(e) => {
														const val = e.target.value ? parseFloat(e.target.value) : null;
														const copy = [...paymentTerms];
														copy[idx].percentage = val;
														setPaymentTerms(copy);
													}}
													placeholder="0"
													className="w-full text-xs font-bold text-text bg-background border border-border pl-3 pr-7 py-3 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
												/>
												<div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
													<span className="text-placeholder text-[10px] font-bold">%</span>
												</div>
											</div>
											<button
												onClick={() => {
													setPaymentTerms(paymentTerms.filter((_, i) => i !== idx));
												}}
												className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer border border-transparent"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</div>
									))}

									{/* Validation sums alert badge */}
									{paymentTerms.length > 0 && (
										<div className="flex items-center gap-1.5 text-[10px] font-bold mt-1">
											{milestoneMath.isValid ? (
												<>
													<Check className="w-3.5 h-3.5 text-primary" />
													<span className="text-primary">Milestones Sum Total: {milestoneMath.sum}% (OK)</span>
												</>
											) : (
												<>
													<AlertCircle className="w-3.5 h-3.5 text-rose-500" />
													<span className="text-rose-500">Milestones Sum Total: {milestoneMath.sum}% (Must equal 100%)</span>
												</>
											)}
										</div>
									)}

									{paymentTerms.length < 5 && (
										<button
											onClick={() => setPaymentTerms([...paymentTerms, { heading: "", percentage: null }])}
											className="py-2.5 bg-card hover:bg-background border border-dashed border-border text-text text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-1"
										>
											<Plus className="w-3.5 h-3.5" />
											<span>Add Payment Milestone</span>
										</button>
									)}
								</div>
							</div>

						</div>
					</div>

					{/* Action confirmation button bar bottom */}
					<div className="bg-background/80 border-t border-border px-8 py-4 flex-shrink-0 flex items-center justify-end gap-3.5 z-10">
						<button
							onClick={handleNextStep}
							disabled={saving || !milestoneMath.isValid}
							className="px-8 py-3 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow transition-all cursor-pointer flex items-center gap-2 border border-transparent"
						>
							{saving ? (
								<>
									<RefreshCw className="w-3.5 h-3.5 animate-spin" />
									<span>Finalizing...</span>
								</>
							) : (
								<>
									<span>Confirm & Save</span>
									<ChevronRight className="w-4 h-4 text-white" />
								</>
							)}
						</button>
					</div>

				</div>

			</div>

		</div>
	);
}
