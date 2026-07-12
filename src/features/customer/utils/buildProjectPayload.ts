import type { CustomerFormValues } from "../types";

export function buildProjectPayload(
	sitevisitId: string,
	values: CustomerFormValues,
	finalize?: boolean
) {
	return {
		sitevisit_id: sitevisitId,
		project_name: values.projectName,
		first_name: values.firstName,
		last_name: values.lastName,
		phone_number: values.phone,
		line1: values.line1,
		line2: values.line2,
		pin: values.pin,
		state: values.state,
		discom: values.discom,
		type: values.type,
		connection_type: values.connectionType,
		project_type: values.projectType,
		mounting_type: values.mountingType,
		capex_opex: values.capexOpex,
		sanctioned_load: values.sanctionedLoad,
		avg_bill: values.avgBill,
		unit_price: values.unitPrice,
		...(finalize !== undefined ? { finalize } : {}),
	};
}
