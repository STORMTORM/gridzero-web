import type { Project } from "../types";

const STAGE_LABELS: Record<number, string> = {
	1: "Customer Details",
	2: "Roof Mapping",
	3: "Obstructions",
	4: "Panel Selection",
	5: "Panel Placement",
	6: "Snapshots",
	7: "Snapshots",
	8: "Proposal",
};

function firstString(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		if (typeof value === "number" && Number.isFinite(value)) {
			return String(value);
		}
	}
	return "";
}

function firstNumber(...values: unknown[]): number | null {
	for (const value of values) {
		if (value == null || value === "") continue;

		const parsed =
			typeof value === "number"
				? value
				: parseFloat(String(value).replace(/[^\d.-]/g, ""));

		if (Number.isFinite(parsed)) return parsed;
	}

	return null;
}

function formatCapacity(value: number | null): string {
	if (value == null || value <= 0) return "0.0 kWp";
	return `${value.toFixed(1)} kWp`;
}

export function mapProject(item: any): Project {
	const addr = item.address || {};
	const md = item.map_details || {};
	const sitevisit = item.sitevisit || {};

	const id = firstString(item.sitevisit_id, item.id, sitevisit.id);

	const stage = firstNumber(item.stage, sitevisit.stage) ?? 1;
	const stageNumber = Math.max(1, Math.floor(stage));
	// Identify strictly by stage as requested
	const status = STAGE_LABELS[stageNumber] || `Stage ${stageNumber}`;

	const capacityKwp = firstNumber(
		item.capacityKwp,
		item.capacity_kwp,
		item.capacity,
		item.capacity_kw,
		item.system_capacity,
		item.selected_capacity,
		sitevisit.capacity,
		sitevisit.capacity_kw,
		md.capacity,
		md.capacity_kw,
	) ?? 0;

	const panels = firstNumber(
		item.panels,
		item.panel_count,
		item.no_of_panels,
		sitevisit.panel_count,
		md.panel_count,
	);

	let customerName = firstString(item.customer);
	if (!customerName) {
		const firstName = firstString(addr.first_name);
		const lastName = firstString(addr.last_name);
		customerName = `${firstName} ${lastName}`.trim() || firstString(addr.name, item.customer_name) || "Valued Customer";
	}

	let address = "";
	if (typeof item.address === "string") {
		address = item.address;
	} else {
		address = [
			firstString(addr.line1, addr.address_line1),
			firstString(addr.line2, addr.address_line2),
			firstString(addr.city),
			firstString(addr.state),
			firstString(addr.pin, addr.pincode),
		]
			.filter(Boolean)
			.join(", ");
	}
	if (!address) {
		address = firstString(item.address_text, md.address) || "No address provided";
	}

	return {
		id,
		name: firstString(item.name, item.project_name, sitevisit.project_name) || "Untitled Project",
		customer: customerName,
		address,
		phone: firstString(addr.phone, addr.mobile, item.phone, item.mobile),
		capacity: formatCapacity(capacityKwp),
		capacityKwp,
		panels: panels != null ? Math.floor(panels) : null,
		status,
		stage: stageNumber,
		date: firstString(item.date, item.created_at, item.createdAt, sitevisit.created_at) || new Date().toISOString(),
	};
}
