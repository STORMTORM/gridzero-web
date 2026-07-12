export interface Project {
	id: string;
	projectName: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	addressLine1: string;
	addressLine2: string;
	city: string;
	state: string;
	pincode: string;
	latitude: number | null;
	longitude: number | null;
	sanctionedLoad: string | number;
	discom: string;
	transformer: string;
	feeder: string;
	stage: number;
	createdAt: string;
	updatedAt: string;
}

export interface CustomerFormValues {
	projectName: string;
	firstName: string;
	lastName: string;
	phone: string;
	line1: string;
	line2: string;
	state: string;
	pin: string;
	discom: string;
	type: string;
	connectionType: string;
	projectType: string;
	mountingType: string;
	capexOpex: string;
	sanctionedLoad: string;
	avgBill: string;
	unitPrice: string;
}

export interface ProjectMetadata {
	imageLink: string;
	irradiance: number | null;
	peakHours: number | null;
}
