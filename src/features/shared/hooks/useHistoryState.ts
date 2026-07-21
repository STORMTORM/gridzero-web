import { useState, useCallback, useRef } from "react";

export interface HistoryStateOptions {
	overwrite?: boolean;
	forcePush?: boolean;
}

export function useHistoryState<T>(initialState: T) {
	const [state, _setState] = useState<T>(initialState);
	const historyRef = useRef<T[]>([initialState]);
	const pointerRef = useRef<number>(0);
	const isRespondingRef = useRef<boolean>(false);
	const lastUpdateRef = useRef<number>(0);

	const setState = useCallback((
		newState: T | ((prev: T) => T),
		options?: boolean | HistoryStateOptions
	) => {
		_setState((prev) => {
			const resolved = typeof newState === "function" ? (newState as Function)(prev) : newState;
			
			if (isRespondingRef.current) {
				return resolved;
			}

			// Parse options
			let overwrite = false;
			let forcePush = false;
			if (typeof options === "boolean") {
				overwrite = options;
			} else if (options) {
				overwrite = !!options.overwrite;
				forcePush = !!options.forcePush;
			}

			const now = Date.now();
			const timeDiff = now - lastUpdateRef.current;
			lastUpdateRef.current = now;

			// If overwrite is not explicitly set, auto-overwrite if update happens within 1200ms
			// (meaning it's part of a continuous drag or slider edit), unless forcePush is true.
			// Also, we must NEVER overwrite the very first state (pointer === 0), as that is our initial baseline.
			const shouldOverwrite = (overwrite || (forcePush ? false : (timeDiff < 1200))) && pointerRef.current > 0;

			if (shouldOverwrite) {
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

	const undo = useCallback((callback?: (state: T) => void) => {
		if (pointerRef.current > 0) {
			isRespondingRef.current = true;
			pointerRef.current--;
			const previousState = historyRef.current[pointerRef.current];
			_setState(previousState);
			isRespondingRef.current = false;
			// Reset last update timestamp so the next action after undo starts fresh
			lastUpdateRef.current = 0;
			if (callback) {
				callback(previousState);
			}
		}
	}, []);

	const redo = useCallback((callback?: (state: T) => void) => {
		if (pointerRef.current < historyRef.current.length - 1) {
			isRespondingRef.current = true;
			pointerRef.current++;
			const nextState = historyRef.current[pointerRef.current];
			_setState(nextState);
			isRespondingRef.current = false;
			// Reset last update timestamp so the next action after redo starts fresh
			lastUpdateRef.current = 0;
			if (callback) {
				callback(nextState);
			}
		}
	}, []);

	const reset = useCallback((newState: T) => {
		historyRef.current = [newState];
		pointerRef.current = 0;
		lastUpdateRef.current = 0;
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
