import React, { createContext, useContext, useState } from "react";

export type UnitSystem = "m" | "ft";

interface UnitContextType {
	unit: UnitSystem;
	setUnit: (u: UnitSystem) => void;
	mToUnit: (val: number) => number;
	unitToM: (val: number) => number;
	formatVal: (val: number, decimals?: number) => string;
	unitLabel: string;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [unit, setUnitState] = useState<UnitSystem>(() => {
		const saved = localStorage.getItem("gridzero_unit_system");
		return (saved === "m" || saved === "ft") ? saved : "m";
	});

	const setUnit = (u: UnitSystem) => {
		setUnitState(u);
		localStorage.setItem("gridzero_unit_system", u);
	};

	const mToUnit = (val: number) => {
		if (unit === "ft") return val * 3.28084;
		return val;
	};

	const unitToM = (val: number) => {
		if (unit === "ft") return val / 3.28084;
		return val;
	};

	const formatVal = (val: number, decimals: number = 1) => {
		const v = mToUnit(val);
		return `${v.toFixed(decimals)}${unit}`;
	};

	return (
		<UnitContext.Provider value={{ unit, setUnit, mToUnit, unitToM, formatVal, unitLabel: unit }}>
			{children}
		</UnitContext.Provider>
	);
};

export const useUnit = () => {
	const context = useContext(UnitContext);
	if (!context) {
		throw new Error("useUnit must be used within a UnitProvider");
	}
	return context;
};
