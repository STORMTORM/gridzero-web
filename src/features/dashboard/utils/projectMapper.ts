import type { Project } from "../types";

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
	if (value == null || value <= 0) return "--";
	return `${value.toFixed(2)} kWp`;
}

export function mapProject(item: any): Project {
	const addr = item.address || {};
	const md = item.map_details || {};
	const sitevisit = item.sitevisit || {};

	const id = firstString(item.sitevisit_id, item.id, sitevisit.id);

	const stage = firstNumber(item.stage, sitevisit.stage) ?? 1;
	const stageNumber = Math.max(1, Math.floor(stage));
	const status = firstString(item.status) || STAGE_LABELS[stageNumber] || "FORM PENDING";

	const capacityKwp = firstNumber(
		item.capacity,
		item.capacity_kw,
		item.system_capacity,
		item.selected_capacity,
		sitevisit.capacity,
		sitevisit.capacity_kw,
		md.capacity,
		md.capacity_kw,
	);

	const panels = firstNumber(
		item.panel_count,
		item.panels,
		item.no_of_panels,
		sitevisit.panel_count,
		md.panel_count,
	);

	const firstName = firstString(addr.first_name);
	const lastName = firstString(addr.last_name);
	const fullName = `${firstName} ${lastName}`.trim();

	const address = [
		firstString(addr.line1, addr.address_line1),
		firstString(addr.line2, addr.address_line2),
		firstString(addr.city),
		firstString(addr.state),
	]
		.filter(Boolean)
		.join(", ");

	return {
		id,
		name: firstString(item.project_name, item.name, sitevisit.project_name) || `Project ${id}`,
		customer: fullName || firstString(addr.name, item.customer_name, item.customer) || `Customer ${id}`,
		address: address || firstString(item.address_text, md.address) || "Captured Map Location",
		phone: firstString(addr.phone, addr.mobile, item.phone, item.mobile),
		capacity: formatCapacity(capacityKwp),
		capacityKwp,
		panels: panels != null ? Math.floor(panels) : null,
		status,
		stage: stageNumber,
		date: firstString(item.created_at, item.createdAt, sitevisit.created_at),
	};
}