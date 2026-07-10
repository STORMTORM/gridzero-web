import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/getProject";
import { saveProject } from "../api/saveProject";
import { mapProjectToForm, mapProjectToMetadata } from "../utils/projectFormMapper";
import { buildProjectPayload } from "../utils/buildProjectPayload";
import type { CustomerFormValues, ProjectMetadata } from "../types";

export function useProjectForm(id: string | undefined) {
	const [formValues, setFormValues] = useState<CustomerFormValues>({
		projectName: "",
		firstName: "",
		lastName: "",
		phone: "",
		line1: "",
		line2: "",
		state: "",
		pin: "",
		discom: "",
		type: "residential",
		connectionType: "single_phase",
		projectType: "ongrid",
		mountingType: "",
		capexOpex: "",
		sanctionedLoad: "",
		avgBill: "",
		unitPrice: "",
	});

	const [metadata, setMetadata] = useState<ProjectMetadata>({
		imageLink: "",
		irradiance: null,
		peakHours: null,
	});

	const [saving, setSaving] = useState(false);

	// Fetch initial project using React Query
	const { data, isLoading: loading } = useQuery({
		queryKey: ["project-raw", id],
		queryFn: () => (id ? getProject(id) : null),
		enabled: !!id,
		staleTime: 0,
		gcTime: 5 * 60 * 1000,
	});

	// Populate local form values once query data arrives
	const hasLoadedInitial = useRef(false);
	const isFirstChange = useRef(true);

	useEffect(() => {
		if (data && !hasLoadedInitial.current) {
			setFormValues(mapProjectToForm(data));
			setMetadata(mapProjectToMetadata(data));
			hasLoadedInitial.current = true;
		}
	}, [data]);

	const updateField = (field: keyof CustomerFormValues, value: string) => {
		setFormValues((prev) => ({ ...prev, [field]: value }));
	};

	// Debounced Auto-save Form Updates to Backend
	useEffect(() => {
		if (!id || !hasLoadedInitial.current) {
			return;
		}
		if (isFirstChange.current) {
			isFirstChange.current = false;
			return;
		}

		const delayDebounceFn = setTimeout(async () => {
			try {
				const payload = buildProjectPayload(id, formValues);
				await saveProject(payload);
				console.log("Customer Intake auto-saved to backend successfully");
			} catch (e) {
				console.error("Auto-save failed", e);
			}
		}, 1500);

		return () => clearTimeout(delayDebounceFn);
	}, [formValues, id]);

	const submitForm = async (finalize?: boolean) => {
		if (!id) return;
		setSaving(true);
		try {
			const payload = buildProjectPayload(id, formValues, finalize);
			await saveProject(payload);
		} finally {
			setSaving(false);
		}
	};

	return {
		formValues,
		metadata,
		updateField,
		loading,
		saving,
		submitForm,
	};
}
