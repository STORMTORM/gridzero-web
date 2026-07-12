import { useState, useMemo } from "react";
import {
	Zap,
	FileText,
	Plus,
	Layers,
	RefreshCw,
	Search,
	Pencil,
	Trash2,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import * as siteVisitApi from "../api/siteVisitApi";
import { useProjects } from "../features/shared/hooks/useProjects";
import type { Project } from "../features/shared/types";
import { mapProject } from "../features/shared/utils/projectMapper";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/queryKeys";

interface DashboardProps {
	onNewProjectClick?: () => void;
	onOpenProject?: (project: Project) => void;
}

export default function Dashboard({
	onNewProjectClick,
	onOpenProject,
}: DashboardProps) {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const PAGE_SIZE = 8;

	const { data, isLoading: loading, error } = useProjects();

	const projects = useMemo<Project[]>(() => {
		const rawList = Array.isArray(data) ? data : (data?.data || []);
		return rawList.map(mapProject);
	}, [data]);

	// Delete site visit
	const handleDeleteProject = async (id: string) => {
		if (!confirm("Are you sure you want to delete this project?")) return;

		try {
			await siteVisitApi.deleteProject(id);

			await queryClient.invalidateQueries({
				queryKey: queryKeys.projects,
			});
		} catch (err) {
			console.error("Failed to delete project", err);
			alert("Failed to delete project. Please try again.");
		}
	};

	console.log(projects);

	const activeDesigns = useMemo(() => {
		return projects.filter((p) => p.stage < 8).length;
	}, [projects]);

	const draftProposals = useMemo(() => {
		return projects.filter((p) => p.stage >= 8).length;
	}, [projects]);

	const totalCapacity = useMemo(() => {
		const total = projects.reduce((acc, project) => {
			return acc + (project.capacityKwp ?? 0);
		}, 0);

		return total.toFixed(1);
	}, [projects]);

	const filteredProjects = useMemo(() => {
		const query = search.trim().toLowerCase();

		if (!query) return projects;

		return projects.filter((project) => {
			return [
				project.id,
				project.name,
				project.customer,
				project.address,
				project.phone,
				project.status,
				project.capacity,
				project.panels != null ? String(project.panels) : "",
			]
				.join(" ")
				.toLowerCase()
				.includes(query);
		});
	}, [projects, search]);

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
		const options: Intl.DateTimeFormatOptions = {
			month: "short",
			day: "numeric",
			year: "numeric",
		};
		return d.toLocaleDateString("en-US", options);
	};

	if (loading) {
		return (
			<div className="flex-grow flex items-center justify-center bg-black min-h-[calc(100vh-4rem)]">
				<div className="flex flex-col items-center gap-3">
					<RefreshCw className="w-8 h-8 text-white animate-spin" />
					<span className="text-sm font-semibold text-neutral-400 animate-pulse">
						Loading project cockpit...
					</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-white">
				Failed to load projects.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-6 md:p-8 h-full bg-black text-neutral-100 overflow-hidden w-full">
			{/* Dashboard Title Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
				<div className="flex flex-col gap-0.5">
					<h1 className="text-2xl font-bold text-white tracking-tight">
						Project Dashboard
					</h1>
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
						<span className="text-xl font-bold text-white">
							{activeDesigns}
						</span>
						<span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
							Active Projects
						</span>
					</div>
				</div>

				{/* Stat 2 */}
				<div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow flex items-center gap-4 hover:border-white/20 transition-all duration-300">
					<div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
						<Zap className="w-4.5 h-4.5" />
					</div>
					<div className="flex flex-col">
						<span className="text-xl font-bold text-white">
							{totalCapacity} kWp
						</span>
						<span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
							Total Capacity
						</span>
					</div>
				</div>

				{/* Stat 3 */}
				<div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow flex items-center gap-4 hover:border-white/20 transition-all duration-300">
					<div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
						<FileText className="w-4.5 h-4.5" />
					</div>
					<div className="flex flex-col">
						<span className="text-xl font-bold text-white">
							{draftProposals}
						</span>
						<span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
							Draft Proposals
						</span>
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
					{/* <div className="w-full sm:w-auto flex items-center gap-3 justify-end">
						<button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold text-neutral-300 border border-white/10 rounded-xl transition-all cursor-pointer">
							<SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
							<span>Filters</span>
						</button>
						<button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 text-xs font-bold text-black border border-transparent rounded-xl transition-all cursor-pointer">
							<Download className="w-3.5 h-3.5 text-black" />
							<span>Export</span>
						</button>
					</div> */}
				</div>

				{/* Table Area wrapper */}
				<div className="flex-grow overflow-hidden min-h-0 py-2 flex flex-col justify-stretch">
					{paginatedProjects.length === 0 ? (
						<div className="py-12 flex flex-col items-center justify-center text-center">
							<Layers className="w-12 h-12 text-neutral-700 mb-4 animate-pulse" />
							<h3 className="text-sm font-bold text-neutral-400">
								No matching projects found
							</h3>
							<p className="text-xs text-neutral-500 mt-1 max-w-xs">
								Refine your query or click "New Project" to
								register a new solar coordinate workspace.
							</p>
						</div>
					) : (
						<div className="w-full flex-grow flex flex-col justify-stretch min-h-0">
							{/* Header Row */}
							<div className="flex-shrink-0 flex items-center border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-neutral-400 pb-4 pt-3 px-5">
								<div className="w-[19%] font-semibold">Project</div>
								<div className="w-[14%] font-semibold">Customer</div>
								<div className="w-[12%] font-semibold">Phone</div>
								<div className="w-[21%] font-semibold">Address</div>
								<div className="w-[11%] font-semibold">Created</div>
								<div className="w-[19%] font-semibold">Status</div>
								<div className="w-[4%] font-semibold text-right">Actions</div>
							</div>

							{/* Data Rows Container */}
							<div className="flex-grow flex flex-col justify-stretch min-h-0">
								{paginatedProjects.map((project) => {
									const isReady = project.stage >= 8;
									const isPending = project.stage === 1;

									return (
										<div
											key={project.id}
											className="flex-1 flex items-center border-b border-white/5 hover:bg-white/5 transition-colors text-xs text-neutral-300 px-5"
										>
											{/* 1. Project Name */}
											<div className="w-[19%] font-bold text-white truncate pr-2">
												<button
													onClick={() =>
														onOpenProject?.(project)
													}
													className="hover:underline cursor-pointer text-left focus:outline-none"
												>
													{project.name}
												</button>
											</div>

											{/* 2. Customer Name */}
											<div className="w-[14%] font-medium text-neutral-250 truncate pr-2">
												{project.customer}
											</div>
												
											<div className="w-[12%] text-neutral-400 truncate pr-2">
												{formatPhone(project.phone)}
											</div>
											
											{/* 4. Address */}
											<div
												className="w-[21%] text-neutral-400 truncate pr-2"
												title={project.address}
											>
												{project.address}
											</div>

											{/* 5. Created Date */}
											<div className="w-[11%] text-neutral-400 truncate">
												{formatDate(project.date)}
											</div>

											{/* 6. Status tag */}
											<div className="w-[19%]">
												<span
													className={`border text-[9px] font-extrabold px-2.5 py-0.5 rounded tracking-wide uppercase ${
														isReady
															? "bg-white/20 text-white border-white/25"
															: isPending
																? "bg-neutral-900 text-neutral-400 border-neutral-850"
																: "bg-white/10 text-white border-white/15"
													}`}
												>
													{project.status.replaceAll("_", " ")}
												</span>
											</div>

											{/* 7. Action Icons */}
											<div className="w-[4%] text-right flex items-center justify-end gap-3">
												<button
													onClick={() =>
														onOpenProject?.(project)
													}
													className="text-neutral-500 hover:text-white transition-colors cursor-pointer focus:outline-none"
													title="Open Workspace"
												>
													<Pencil className="w-3.5 h-3.5" />
												</button>
												<button
													onClick={() =>
														handleDeleteProject(
															project.id,
														)
													}
													className="text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer focus:outline-none"
													title="Delete Project"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* Bottom Pagination Bar */}
				{totalResults > 0 && (
					<div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-white/10 text-xs text-neutral-400 flex-shrink-0">
						<span>
							Showing {startIndex + 1}-{endIndex} of{" "}
							{totalResults} results
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
								onClick={() =>
									setCurrentPage((p) => Math.max(1, p - 1))
								}
								disabled={activePage === 1}
								className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							{/* Page Numbers */}
							{Array.from({ length: totalPages })
								.map((_, index) => index + 1)
								.filter((pageNum) => {
									return (
										pageNum === 1 ||
										pageNum === totalPages ||
										Math.abs(pageNum - activePage) <= 1
									);
								})
								.map((pageNum, index, pages) => {
									const previous = pages[index - 1];
									const showGap = previous != null && pageNum - previous > 1;
									const isActive = pageNum === activePage;

									return (
										<div key={pageNum} className="flex items-center gap-1.5">
											{showGap ? (
												<span className="text-neutral-600 px-1">...</span>
											) : null}

											<button
												onClick={() => setCurrentPage(pageNum)}
												className={`w-7 h-7 flex items-center justify-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
													isActive
														? "bg-white text-black"
														: "hover:bg-white/10 text-neutral-400 hover:text-white"
												}`}
											>
												{pageNum}
											</button>
										</div>
									);
							})}

							<button
								onClick={() =>
									setCurrentPage((p) =>
										Math.min(totalPages, p + 1),
									)
								}
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
