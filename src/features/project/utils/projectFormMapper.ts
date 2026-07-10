import type { CustomerFormValues, ProjectMetadata } from "../types";

export function mapProjectToForm(data: any): CustomerFormValues {
	const addr = data.address || {};
	const d = data.map_details || {};

	return {
		projectName: d.project_name || "",
		firstName: addr.first_name || "",
		lastName: addr.last_name || "",
		phone: addr.phone ? String(addr.phone) : "",
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
	};
}

export function mapProjectToMetadata(data: any): ProjectMetadata {
	const d = data.map_details || {};

	let irradiance: number | null = null;
	if (d.irradiance != null) {
		irradiance = Number(d.irradiance);
	} else if (data.irradiance != null) {
		irradiance = Number(data.irradiance);
	}

	let peakHours: number | null = null;
	if (d.peak_hours != null) {
		peakHours = Number(d.peak_hours);
	} else if (data.peak_hours != null) {
		peakHours = Number(data.peak_hours);
	}

	return {
		imageLink: data.image_link || "",
		irradiance,
		peakHours,
	};
}
