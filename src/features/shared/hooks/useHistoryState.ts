import { useState, useCallback, useRef } from "react";

export function useHistoryState<T>(initialState: T) {
	const [state, _setState] = useState<T>(initialState);
	const historyRef = useRef<T[]>([initialState]);
	const pointerRef = useRef<number>(0);
	const isRespondingRef = useRef<boolean>(false);

	const setState = useCallback((newState: T | ((prev: T) => T), overwrite = false) => {
		_setState((prev) => {
			const resolved = typeof newState === "function" ? (newState as Function)(prev) : newState;
			
			if (isRespondingRef.current) {
				return resolved;
			}

			if (overwrite) {
				historyRef.current[pointerRef.current] = resolved;
			} else {
				// Cut off any future history if we were in the middle of undo/redo
				const nextHistory = historyRef.current.slice(0, pointerRef.current + 1);
				nextHistory.push(resolved);
				historyRef.current = nextHistory;
				pointerRef.current = nextHistory.length - 1;
			}

			return resolved;
		});
	}, []);

	const undo = useCallback(() => {
		if (pointerRef.current > 0) {
			isRespondingRef.current = true;
			pointerRef.current--;
			const previousState = historyRef.current[pointerRef.current];
			_setState(previousState);
			isRespondingRef.current = false;
		}
	}, []);

	const redo = useCallback(() => {
		if (pointerRef.current < historyRef.current.length - 1) {
			isRespondingRef.current = true;
			pointerRef.current++;
			const nextState = historyRef.current[pointerRef.current];
			_setState(nextState);
			isRespondingRef.current = false;
		}
	}, []);

	const reset = useCallback((newState: T) => {
		historyRef.current = [newState];
		pointerRef.current = 0;
		_setState(newState);
	}, []);

	const canUndo = pointerRef.current > 0;
	const canRedo = pointerRef.current < historyRef.current.length - 1;

	return {
		state,
		setState,
		undo,
		redo,
		canUndo,
		canRedo,
		reset,
	};
}
