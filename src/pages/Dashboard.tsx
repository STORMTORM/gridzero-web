import { useState, useEffect } from "react";
import {
	Zap,
	FileText,
	Plus,
	Layers,
	RefreshCw,
	Search,
	SlidersHorizontal,
	Download,
	Phone,
	MessageSquare,
	Pencil,
	Trash2,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import api from "../api/client";

interface Project {
	id: string;
	name: string;
	customer: string;
	address: string;
	phone: string;
	email: string;
	capacity: string;
	panels: number;
	status: string;
	date: string;
}

interface DashboardProps {
	onNewProjectClick?: () => void;
	onOpenProject?: (project: Project) => void;
}

const STAGE_LABELS: Record<number, string> = {
	1: "FORM PENDING",
	2: "ROOF MAPPING",
	3: "OBSTRUCTIONS",
	4: "PANEL SELECTION",
	5: "PANEL PLACEMENT",
	6: "WIRING",
	7: "COMPLIANCE",
	8: "PROPOSAL",
};

export default function Dashboard({ onNewProjectClick, onOpenProject }: DashboardProps) {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const PAGE_SIZE = 6;

	// Fetch dynamic projects list from live server /visit/all
	const fetchProjects = async () => {
		try {
			setLoading(true);
			const res = await api.get("/visit/all", { params: { limit: "100", sort: "-created_at" } });
			const serverData = res.data?.data || [];
			
			const mapped: Project[] = serverData.map((item: any) => {
				const addr = item.address || {};
				const md = item.map_details || {};
				const loadVal = md.sanctioned_load || item.sanctioned_load;
				
				const capacity = loadVal ? `${parseFloat(loadVal).toFixed(1)} kWp` : "10.0 kWp";
				const panels = loadVal ? Math.round(parseFloat(loadVal) * 2) : 20;
				
				const stageNum = Number(item.stage) || 1;
				const status = STAGE_LABELS[stageNum] || "FORM PENDING";

				return {
					id: String(item.sitevisit_id),
					name: item.project_name || `Project ${item.sitevisit_id}`,
					customer: `${addr.first_name || ""} ${addr.last_name || ""}`.trim() || addr.name || `Customer ${item.sitevisit_id}`,
					address: addr.line1 || "Captured Map Location",
					phone: addr.phone ? String(addr.phone) : "",
					email: addr.email || "",
					capacity,
					panels,
					status,
					date: item.created_at || "",
				};
			});

			setProjects(mapped);
		} catch (e) {
			console.error("Failed to fetch projects from backend", e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchProjects();
	}, []);

	// Delete site visit
	const handleDeleteProject = async (id: string) => {
		if (!confirm("Are you sure you want to delete this project?")) return;
		try {
			await api.delete(`/visit/${id}`);
			setProjects((prev) => prev.filter((p) => p.id !== id));
		} catch (err) {
			console.error("Failed to delete project", err);
			alert("Failed to delete project. Please try again.");
		}
	};

	// Recalculate stats based on active projects
	const activeDesigns = projects.filter((p) => p.status !== "PROPOSAL").length;
	const draftProposals = projects.filter((p) => p.status === "PROPOSAL").length;
	
	const totalCapacity = projects.reduce((acc, p) => {
		const parsed = parseFloat(p.capacity.replace(/[^\d.]/g, ""));
		return acc + (isNaN(parsed) ? 0 : parsed);
	}, 0).toFixed(1);

	// Filter project list based on search criteria
	const filteredProjects = projects.filter((p) => {
		const query = search.toLowerCase();
		return (
			p.name.toLowerCase().includes(query) ||
			p.customer.toLowerCase().includes(query) ||
			p.address.toLowerCase().includes(query)
		);
	});

	// Pagination variables
	const totalResults = filteredProjects.length;
	const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1;
	const activePage = Math.min(currentPage, totalPages);

	const startIndex = (activePage - 1) * PAGE_SIZE;
	const endIndex = Math.min(startIndex + PAGE_SIZE, totalResults);
	const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

	const formatPhone = (phoneStr: string) => {
		if (!phoneStr) return "--";
		const cleaned = phoneStr.replace(/\D/g, "");
		if (cleaned.length === 10) {
			return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
		}
		return phoneStr;
	};

	const formatDate = (dateStr: string) => {
		if (!dateStr) return "--";
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
		return d.toLocaleDateString("en-US", options);
	};

	if (loading) {
		return (
			<div className="flex-grow flex items-center justify-center bg-black min-h-[calc(100vh-4rem)]">
				<div className="flex flex-col items-center gap-3">
					<RefreshCw className="w-8 h-8 text-white animate-spin" />
					<span className="text-sm font-semibold text-neutral-400 animate-pulse">Loading project cockpit...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-6 md:p-8 h-full bg-black text-neutral-100 overflow-hidden w-full">
			
			{/* Dashboard Title Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
				<div className="flex flex-col gap-0.5">
					<h1 className="text-2xl font-bold text-white tracking-tight">Project Dashboard</h1>
					<p className="text-xs text-neutral-500">
						Manage, model, and dispatch premium solar proposals.
					</p>
				</div>
				<button
					onClick={onNewProjectClick}
					className="bg-white hover:bg-neutral-200 text-black text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 shadow cursor-pointer self-start md:self-auto border border-transparent"
				>
					<Plus className="w-3.5 h-3.5 text-black" />
					<span>New Project</span>
				</button>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-shrink-0">
				{/* Stat 1 */}
				<div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow flex items-center gap-4 hover:border-white/20 transition-all duration-300">
					<div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
						<Layers className="w-4.5 h-4.5" />
					</div>
					<div className="flex flex-col">
						<span className="text-xl font-bold text-white">{activeDesigns}</span>
						<span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Active Projects</span>
					</div>
				</div>

				{/* Stat 2 */}
				<div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow flex items-center gap-4 hover:border-white/20 transition-all duration-300">
					<div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
						<Zap className="w-4.5 h-4.5" />
					</div>
					<div className="flex flex-col">
						<span className="text-xl font-bold text-white">{totalCapacity} kWp</span>
						<span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Designed Capacity</span>
					</div>
				</div>

				{/* Stat 3 */}
				<div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow flex items-center gap-4 hover:border-white/20 transition-all duration-300">
					<div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
						<FileText className="w-4.5 h-4.5" />
					</div>
					<div className="flex flex-col">
						<span className="text-xl font-bold text-white">{draftProposals}</span>
						<span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Draft Proposals</span>
					</div>
				</div>
			</div>

			{/* Project List Dark Card container */}
			<div className="bg-white/5 rounded-3xl border border-white/10 shadow flex-grow flex flex-col justify-between p-6 overflow-hidden">
				
				{/* Top Search & Actions Bar */}
				<div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/10 pb-4 flex-shrink-0">
					{/* Search input */}
					<div className="w-full sm:max-w-md flex items-center gap-2.5 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
						<Search className="w-4 h-4 text-neutral-500" />
						<input
							type="text"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setCurrentPage(1);
							}}
							placeholder="Search project name, customer..."
							className="w-full text-xs font-semibold text-neutral-200 placeholder-neutral-500 bg-transparent focus:outline-none"
						/>
					</div>

					{/* Header Actions Buttons */}
					<div className="w-full sm:w-auto flex items-center gap-3 justify-end">
						<button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold text-neutral-300 border border-white/10 rounded-xl transition-all cursor-pointer">
							<SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
							<span>Filters</span>
						</button>
						<button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 text-xs font-bold text-black border border-transparent rounded-xl transition-all cursor-pointer">
							<Download className="w-3.5 h-3.5 text-black" />
							<span>Export</span>
						</button>
					</div>
				</div>

				{/* Table Area wrapper */}
				<div className="flex-grow overflow-y-auto min-h-0 py-2">
					{paginatedProjects.length === 0 ? (
						<div className="py-12 flex flex-col items-center justify-center text-center">
							<Layers className="w-12 h-12 text-neutral-700 mb-4 animate-pulse" />
							<h3 className="text-sm font-bold text-neutral-400">No matching projects found</h3>
							<p className="text-xs text-neutral-500 mt-1 max-w-xs">
								Refine your query or click "New Project" to register a new solar coordinate workspace.
							</p>
						</div>
					) : (
						<div className="overflow-x-auto w-full">
							<table className="w-full border-collapse">
								<thead>
									<tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-neutral-400 text-left">
										<th className="pb-4 pt-3 px-5 font-semibold">Project Name</th>
										<th className="pb-4 pt-3 px-5 font-semibold">Customer Name</th>
										<th className="pb-4 pt-3 px-5 font-semibold">Phone</th>
										<th className="pb-4 pt-3 px-5 font-semibold">Address</th>
										<th className="pb-4 pt-3 px-5 font-semibold">Created</th>
										<th className="pb-4 pt-3 px-5 font-semibold">Status</th>
										<th className="pb-4 pt-3 px-5 font-semibold text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{paginatedProjects.map((project) => {
										const isReady = project.status === "PROPOSAL" || project.status === "COMPLIANCE";
										const isPending = project.status === "FORM PENDING";

										return (
											<tr
												key={project.id}
												className="border-b border-white/5 hover:bg-white/5 transition-colors text-xs text-neutral-300"
											>
												{/* 1. Project Name */}
												<td className="py-[18px] px-5 font-bold text-white">
													<button
														onClick={() => onOpenProject?.(project)}
														className="hover:underline cursor-pointer text-left focus:outline-none"
													>
														{project.name}
													</button>
												</td>

												{/* 2. Customer Name */}
												<td className="py-[18px] px-5 font-medium text-neutral-200">{project.customer}</td>

												{/* 3. Phone */}
												<td className="py-[18px] px-5 text-neutral-400">{formatPhone(project.phone)}</td>

												{/* 4. Address */}
												<td className="py-[18px] px-5 text-neutral-400 truncate max-w-[200px]" title={project.address}>
													{project.address}
												</td>

												{/* 5. Created Date */}
												<td className="py-[18px] px-5 text-neutral-400">{formatDate(project.date)}</td>

												{/* 6. Status tag */}
												<td className="py-[18px] px-5">
													<span className={`border text-[9px] font-extrabold px-2.5 py-0.5 rounded tracking-wide uppercase ${
														isReady
															? "bg-white/20 text-white border-white/25"
															: isPending
															? "bg-neutral-900 text-neutral-400 border-neutral-850"
															: "bg-white/10 text-white border-white/15"
													}`}>
														{project.status.replace("_", " ")}
													</span>
												</td>

												{/* 7. Action Icons */}
												<td className="py-[18px] px-5 text-right">
													<div className="flex items-center justify-end gap-3.5">
														<a
															href={`tel:${project.phone}`}
															className="text-neutral-500 hover:text-white transition-colors"
															title="Call Customer"
														>
															<Phone className="w-3.5 h-3.5" />
														</a>
														<a
															href={`mailto:${project.email || ""}`}
															className="text-neutral-500 hover:text-white transition-colors"
															title="Email Customer"
														>
															<MessageSquare className="w-3.5 h-3.5" />
														</a>
														<button
															onClick={() => onOpenProject?.(project)}
															className="text-neutral-500 hover:text-white transition-colors cursor-pointer focus:outline-none"
															title="Open Workspace"
														>
															<Pencil className="w-3.5 h-3.5" />
														</button>
														<button
															onClick={() => handleDeleteProject(project.id)}
															className="text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer focus:outline-none"
															title="Delete Project"
														>
															<Trash2 className="w-3.5 h-3.5" />
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Bottom Pagination Bar */}
				{totalResults > 0 && (
					<div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-white/10 text-xs text-neutral-400 flex-shrink-0">
						<span>
							Showing {startIndex + 1}-{endIndex} of {totalResults} results
						</span>

						{/* Paginated Navigation buttons */}
						<div className="flex items-center gap-1.5">
							<button
								onClick={() => setCurrentPage(1)}
								disabled={activePage === 1}
								className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
							>
								<ChevronsLeft className="w-4 h-4" />
							</button>
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={activePage === 1}
								className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							{/* Page Numbers */}
							{Array.from({ length: totalPages }).map((_, index) => {
								const pageNum = index + 1;
								const isActive = pageNum === activePage;

								return (
									<button
										key={pageNum}
										onClick={() => setCurrentPage(pageNum)}
										className={`w-7 h-7 flex items-center justify-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
											isActive
												? "bg-white text-black"
												: "hover:bg-white/10 text-neutral-400 hover:text-white"
										}`}
									>
										{pageNum}
									</button>
								);
							})}

							<button
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={activePage === totalPages}
								className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
							<button
								onClick={() => setCurrentPage(totalPages)}
								disabled={activePage === totalPages}
								className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
							>
								<ChevronsRight className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}

			</div>
		</div>
	);
}
