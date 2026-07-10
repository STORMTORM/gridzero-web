import type { Project } from "../types";

export function mapProject(data: any): Project {
	const address = data.address ?? {};
	const mapDetails = data.map_details ?? {};

	return {
		id: String(data.sitevisit_id),

		projectName: data.project_name ?? "",

		firstName: address.first_name ?? "",
		lastName: address.last_name ?? "",
		email: address.email ?? "",
		phone: address.phone ? String(address.phone) : "",

		addressLine1: address.line1 ?? "",
		addressLine2: address.line2 ?? "",
		city: address.city ?? "",
		state: address.state ?? "",
		pincode: address.pincode ?? "",

		latitude: mapDetails.latitude ?? null,
		longitude: mapDetails.longitude ?? null,

		sanctionedLoad:
			mapDetails.sanctioned_load ??
			data.sanctioned_load ??
			"",

		discom: mapDetails.discom ?? "",
		transformer: mapDetails.transformer ?? "",
		feeder: mapDetails.feeder ?? "",

		stage: Number(data.stage ?? 1),

		createdAt: data.created_at ?? "",
		updatedAt: data.updated_at ?? "",
	};
}