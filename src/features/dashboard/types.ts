export interface Project {
	id: string;
	name: string;
	customer: string;
	address: string;
	phone: string;

	// Display-ready values
	capacity: string;
	panels: number | null;
	status: string;
	date: string;

	// Real numeric values for stats/sorting
	capacityKwp: number | null;
	stage: number;
}