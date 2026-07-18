import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Box, FileText, ArrowRight, RefreshCw, ArrowLeft, Search, MapPin, LoaderCircle } from "lucide-react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { toBlob } from "html-to-image";
import * as siteVisitApi from "../api/siteVisitApi";
import { isGoogleMapsUrl, isShortMapsUrl, coordsFromIncomingUrl, resolveMapUrl } from "../utils/design/mapLinkCoords";

interface NewProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
}

function MapInstanceHolder({ onLoad }: { onLoad: (map: any) => void }) {
	const map = useMap();
	useEffect(() => {
		if (map) {
			onLoad(map);
		}
	}, [map, onLoad]);
	return null;
}

export default function NewProjectModal({
	isOpen,
	onClose,
}: NewProjectModalProps) {
	const navigate = useNavigate();
	const [view, setView] = useState<"selection" | "map">("selection");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const [mapCenter, setMapCenter] = useState({ lat: 12.9348, lng: 77.6189 });

	// Search Panel states
	const [searchQuery, setSearchQuery] = useState("");
	const [suggestions, setSuggestions] = useState<any[]>([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [coordMode, setCoordMode] = useState(false);
	const [latInput, setLatInput] = useState("");
	const [lngInput, setLngInput] = useState("");
	const [coordError, setCoordError] = useState<string | null>(null);
	
	const newSessionToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
	const [sessionToken, setSessionToken] = useState(newSessionToken());

	const latestRequest = useRef(0);

	const navigateToCoords = (lat: number, lng: number) => {
		const coords = { lat, lng };
		setMapCenter(coords);
		if (mapRef.current) {
			mapRef.current.setCenter(coords);
			mapRef.current.setZoom(19);
		}
	};

	const COORD_REGEX = /^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/;
	const parseCoords = (text: string): { lat: number; lng: number } | null => {
		const match = text.trim().match(COORD_REGEX);
		if (!match) return null;
		const lat = parseFloat(match[1]);
		const lng = parseFloat(match[2]);
		if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
		return { lat, lng };
	};

	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (trimmed.length < 2) {
			setSuggestions([]);
			setSearchError(null);
			return;
		}

		if (isGoogleMapsUrl(trimmed)) {
			setSuggestions([]);
			setSearchError(null);
			const reqId = latestRequest.current + 1;
			latestRequest.current = reqId;
			const timer = setTimeout(async () => {
				setLoadingSuggestions(true);
				try {
					let coords = coordsFromIncomingUrl(trimmed);
					if (!coords && isShortMapsUrl(trimmed)) {
						const resolved = await resolveMapUrl(trimmed);
						if (resolved) {
							coords = { latitude: resolved.latitude, longitude: resolved.longitude };
						}
					}
					if (latestRequest.current !== reqId) return;
					setSearchQuery("");
					setSuggestions([]);
					if (coords) {
						navigateToCoords(coords.latitude, coords.longitude);
					} else {
						setSearchError("Couldn't read a location from that Google Maps link.");
					}
				} catch (e) {
					if (latestRequest.current === reqId) setSearchError("Failed to resolve link.");
				} finally {
					if (latestRequest.current === reqId) setLoadingSuggestions(false);
				}
			}, 450);
			return () => clearTimeout(timer);
		}

		const coords = parseCoords(trimmed);
		if (coords) {
			setSuggestions([
				{
					place_id: "__coords__",
					description: trimmed,
					isCoords: true,
					coordLatitude: coords.lat,
					coordLongitude: coords.lng,
					structured_formatting: {
						main_text: `${coords.lat}°, ${coords.lng}°`,
						secondary_text: "Navigate to coordinates",
					},
				},
			]);
			setSearchError(null);
			return;
		}

		const requestId = latestRequest.current + 1;
		latestRequest.current = requestId;

		const timer = setTimeout(async () => {
			try {
				setLoadingSuggestions(true);
				setSearchError(null);
				const data = await siteVisitApi.getPlacesAutocomplete(trimmed, sessionToken);
				if (latestRequest.current !== requestId) return;
				const predictions = data?.predictions;
				setSuggestions(Array.isArray(predictions) ? predictions : []);
			} catch (e) {
				if (latestRequest.current !== requestId) return;
				setSuggestions([]);
				setSearchError("Unable to fetch suggestions");
			} finally {
				if (latestRequest.current === requestId) setLoadingSuggestions(false);
			}
		}, 280);

		return () => clearTimeout(timer);
	}, [searchQuery, sessionToken]);

	const selectSuggestion = async (item: any) => {
		if (item.isCoords && item.coordLatitude != null && item.coordLongitude != null) {
			setSearchQuery("");
			setSuggestions([]);
			navigateToCoords(item.coordLatitude, item.coordLongitude);
			return;
		}

		try {
			setLoadingSuggestions(true);
			const data = await siteVisitApi.getPlacesDetails(item.place_id, sessionToken);
			const location = data?.location;
			if (location?.latitude == null || location?.longitude == null) {
				setSearchError("Unable to open this location");
				return;
			}

			setSearchQuery(item.description);
			setSuggestions([]);
			setSearchError(null);
			navigateToCoords(location.latitude, location.longitude);
		} catch (e) {
			setSearchError("Unable to open this location");
		} finally {
			setSessionToken(newSessionToken());
			setLoadingSuggestions(false);
		}
	};

	const handleGoCoords = () => {
		const lat = parseFloat(latInput.trim());
		const lng = parseFloat(lngInput.trim());
		if (isNaN(lat) || lat < -90 || lat > 90) {
			setCoordError("Latitude must be between -90 and 90");
			return;
		}
		if (isNaN(lng) || lng < -180 || lng > 180) {
			setCoordError("Longitude must be between -180 and 180");
			return;
		}
		setCoordError(null);
		navigateToCoords(lat, lng);
	};


	const mapRef = useRef<any>(null);
	const mapElementRef = useRef<HTMLDivElement>(null);

	// Close modal on Escape key press
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
			}
		};
		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "hidden";
		}
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	const handleClose = () => {
		setView("selection");
		setLoading(false);
		setError("");
		onClose();
	};

	// Center map based on browser geolocation when panned/opened
	useEffect(() => {
		if (view !== "map" || !isOpen) return;
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const coords = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					};
					setMapCenter(coords);
					if (mapRef.current) {
						mapRef.current.setCenter(coords);
					}
				},
				() => {
					setMapCenter({ lat: 12.9348, lng: 77.6189 });
				},
				{ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
			);
		}
	}, [view, isOpen]);

	// Simple loader ref hook
	const handleMapLoad = (map: any) => {
		mapRef.current = map;
	};

	// Capture Map Div and POST to Live Server
	const handleConfirmLocation = async () => {
		if (!mapElementRef.current || !mapRef.current) return;

		setLoading(true);
		setError("");

		try {
			// 1. Resolve center latitude and longitude values
			const center = mapRef.current.getCenter();
			if (!center) throw new Error("Could not retrieve map center coordinates.");
			const lat = center.lat();
			const lng = center.lng();

			// Temporarily zoom out the map by 1 level to include the surrounding overscan region
			const originalZoom = mapRef.current.getZoom() || 19;
			mapRef.current.setZoom(originalZoom - 1);

			// Wait for Google Maps to fetch and render the zoomed-out satellite tiles fully
			await new Promise((resolve) => setTimeout(resolve, 450));

			// 2. Perform EXACTLY ONE targeted reverse geocode lookup
			let resolvedAddress = {
				line1: "Captured Map Location",
				line2: "",
				pin: "",
				state: "",
			};

			const google = (window as any).google;
			if (google) {
				const geocoder = new google.maps.Geocoder();
				try {
					const geocodeResult = await new Promise<any>((resolve, reject) => {
						geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
							if (status === "OK" && results && results[0]) {
								resolve(results[0]);
							} else {
								reject(new Error("Google geocode failed"));
							}
						});
					});

					const components = geocodeResult.address_components || [];
					let route = "";
					let sublocality = "";
					let locality = "";
					let state = "";
					let pin = "";

					components.forEach((c: any) => {
						const types = c.types || [];
						if (types.includes("route")) route = c.long_name;
						if (types.includes("sublocality") || types.includes("sublocality_level_1")) sublocality = c.long_name;
						if (types.includes("locality")) locality = c.long_name;
						if (types.includes("administrative_area_level_1")) state = c.long_name;
						if (types.includes("postal_code")) pin = c.long_name;
					});

					const line1 = [route, sublocality].filter(Boolean).join(", ") || geocodeResult.formatted_address;
					resolvedAddress = {
						line1: line1 || "Captured Map Location",
						line2: locality,
						pin: pin,
						state: state,
					};
				} catch (err) {
					console.warn("Google geocoding fallback to Nominatim", err);
					// Nominatim Fallback
					try {
						const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
							headers: {
								"Accept-Language": "en",
								"User-Agent": "GridZero-Solar-Designer"
							}
						});
						if (res.ok) {
							const data = await res.json();
							if (data && data.address) {
								const addr = data.address;
								const road = addr.road || "";
								const suburb = addr.suburb || addr.neighbourhood || "";
								const city = addr.city || addr.town || addr.village || "";
								const state = addr.state || "";
								const postcode = addr.postcode || "";

								resolvedAddress = {
									line1: [road, suburb].filter(Boolean).join(", ") || data.display_name,
									line2: city,
									pin: postcode,
									state: state,
								};
							}
						}
					} catch (e) {
						console.error("Nominatim reverse geocode failed", e);
					}
				}
			}

			// 3. Snapshot the visible map container div
			const mapEl = mapElementRef.current;
			const width = mapEl?.clientWidth || mapEl?.offsetWidth || 0;
			const height = mapEl?.clientHeight || mapEl?.offsetHeight || 0;

			// Force perfect square bounds
			const size = Math.round(Math.min(width, height));

			// Do NOT force pixelRatio: 1, to prevent high-DPI scaling grid/tiling repetition bugs
			const imageBlob = await toBlob(mapEl!, {
				skipFonts: true,
				width: size,
				height: size,
				style: {
					left: "0",
					top: "0",
					width: `${size}px`,
					height: `${size}px`,
					transform: "none",
				}
			});

			// Restore the original map zoom level in the DOM immediately
			mapRef.current.setZoom(originalZoom);

			if (!imageBlob) throw new Error("Failed to generate map image snapshot from canvas.");
			const file = new File([imageBlob], `map_snapshot_${Date.now()}.png`, { type: "image/png" });

			// 4. Fetch NASA Solar Irradiance data in parallel
			const solarPromise = (async () => {
				try {
					const nasaUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?start=2015&end=2024&latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&community=re&parameters=ALLSKY_SFC_SW_DWN&format=json&time-standard=utc`;
					const nasaResp = await fetch(nasaUrl);
					if (nasaResp.ok) {
						const nasaData = await nasaResp.json();
						const monthly = nasaData?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
						if (monthly) {
							const vals = Object.entries(monthly)
								.filter(([k]) => !k.endsWith("13"))
								.map(([, v]) => v as number)
								.filter((v) => v > 0);
							if (vals.length > 0) {
								const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
								return { irradiance: avg, peakHours: avg };
							}
						}
					}
				} catch (e) {
					console.error("NASA API fetch failed", e);
				}
				return null;
			})();

			const solar = await solarPromise;

			// 5. Resolve coordinate corners of the large capture viewport
			let corners = [
				[lat + 0.0005, lng - 0.0005],
				[lat + 0.0005, lng + 0.0005],
				[lat - 0.0005, lng + 0.0005],
				[lat - 0.0005, lng - 0.0005],
			];

			if (mapRef.current) {
				const bounds = mapRef.current.getBounds();
				if (bounds) {
					const ne = bounds.getNorthEast();
					const sw = bounds.getSouthWest();
					corners = [
						[ne.lat(), sw.lng()], // Top-Left
						[ne.lat(), ne.lng()], // Top-Right
						[sw.lat(), ne.lng()], // Bottom-Right
						[sw.lat(), sw.lng()], // Bottom-Left
					];
				}
			}

			// 6. Prepare Multipart upload
			const formData = new FormData();
			formData.append("file", file);
			formData.append("type", "map");
			formData.append("corners", JSON.stringify(corners));
			formData.append("address", JSON.stringify({
				line1: resolvedAddress.line1,
				line2: resolvedAddress.line2,
				pin: resolvedAddress.pin,
				state: resolvedAddress.state,
			}));

			if (solar) {
				formData.append("irradiance", String(solar.irradiance));
				formData.append("peak_hours", String(solar.peakHours));
			}

			// 7. Submit to backend API endpoint
			const res = await siteVisitApi.createProject(formData);

			const sitevisitId = res?.sitevisit_id;
			if (!sitevisitId) throw new Error("No sitevisit_id returned from server");

			// Complete and route
			handleClose();
			navigate(`/project/${sitevisitId}/details`);
		} catch (err: any) {
			console.error("Failed to upload map snapshot", err);
			setError(err?.response?.data?.detail || err?.message || "Could not upload map snapshot.");
			setLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* background blur overlay */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
				onClick={loading ? undefined : handleClose}
			/>

			{/* Modal Container */}
			<div className="relative w-full max-w-xl bg-black rounded-3xl border border-white/10 overflow-hidden p-6 flex flex-col gap-5 animate-in fade-in duration-300 z-10 text-neutral-100 shadow-2xl">
				
				{/* Top bar with close trigger */}
				<div className="flex flex-row justify-between items-center flex-shrink-0">
					<div className="flex flex-col gap-1">
						<span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
							Start a New Project
						</span>
						<h2 className="text-xl font-bold text-white tracking-tight">
							{view === "selection" ? "Select Project Workflow" : "Confirm Solar Site Location"}
						</h2>
					</div>
					
					{!loading && (
						<button
							onClick={handleClose}
							className="text-neutral-500 hover:text-white hover:bg-neutral-900 p-2 rounded-full transition-colors cursor-pointer"
							aria-label="Close modal"
						>
							<X className="w-4.5 h-4.5" />
						</button>
					)}
				</div>

				{/* Error display */}
				{error && (
					<div className="bg-rose-950/20 border border-rose-900/50 text-rose-300 p-3 rounded-xl text-xs font-semibold">
						{error}
					</div>
				)}

				{/* VIEW 1: Selection Grid */}
				{view === "selection" && (
					<div className="flex flex-col gap-3">
						{/* Option 1: 3D Modelling + Proposal */}
						<button
							onClick={() => setView("map")}
							className="group flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 text-left cursor-pointer relative overflow-hidden"
						>
							<div className="w-11 h-11 bg-black rounded-xl border border-white/10 flex items-center justify-center text-white shadow transition-all">
								<Box className="w-5.5 h-5.5 group-hover:scale-110 transition-transform" />
							</div>
							<div className="flex-1 flex items-center justify-between">
								<span className="font-bold text-white text-sm">
									3D Modelling + Proposal
								</span>
								<ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
							</div>
						</button>

						{/* Option 2: Proposal Only */}
						<button
							onClick={() => {
								alert("Proposal Only flow requested.");
								handleClose();
							}}
							className="group flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 text-left cursor-pointer relative overflow-hidden"
						>
							<div className="w-11 h-11 bg-black rounded-xl border border-white/10 flex items-center justify-center text-white shadow transition-all">
								<FileText className="w-5.5 h-5.5" />
							</div>
							<div className="flex-1 flex items-center justify-between">
								<span className="font-bold text-white text-sm">
									Proposal Only
								</span>
								<ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
							</div>
						</button>
					</div>
				)}

				{/* VIEW 2: Basic Satellite Map Capture */}
				{view === "map" && (
					<div className="flex flex-col gap-4 relative">
						
						{/* Search / Coord Panel Above Map */}
						<div className="relative flex flex-col gap-2.5 w-full">
							{/* Tab selector */}
							<div className="bg-neutral-900 border border-white/10 p-0.5 rounded-full flex self-start text-[10px] font-bold text-neutral-400 select-none shadow-md">
								<button
									type="button"
									onClick={() => {
										setCoordMode(false);
										setCoordError(null);
									}}
									className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
										!coordMode
											? "bg-white text-black font-extrabold"
											: "hover:text-white"
									}`}
								>
									Search
								</button>
								<button
									type="button"
									onClick={() => {
										setCoordMode(true);
										setSuggestions([]);
										setSearchError(null);
									}}
									className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
										coordMode
											? "bg-white text-black font-extrabold"
											: "hover:text-white"
									}`}
								>
									Lat / Lng
								</button>
							</div>

							{coordMode ? (
								<div className="flex gap-1.5 items-center w-full rounded-2xl shadow-md">
									<input
										type="text"
										value={latInput}
										onChange={(e) => {
											setLatInput(e.target.value);
											setCoordError(null);
										}}
										placeholder="Latitude"
										className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 w-full focus:outline-none focus:border-white/20"
									/>
									<input
										type="text"
										value={lngInput}
										onChange={(e) => {
											setLngInput(e.target.value);
											setCoordError(null);
										}}
										placeholder="Longitude"
										className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 w-full focus:outline-none focus:border-white/20"
										onKeyDown={(e) => {
											if (e.key === "Enter") handleGoCoords();
										}}
									/>
									<button
										type="button"
										onClick={handleGoCoords}
										className="bg-white hover:bg-neutral-200 text-black px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 flex-shrink-0"
									>
										Go
									</button>
								</div>
							) : (
								<div className="relative w-full">
									<div className="flex items-center bg-neutral-900 border border-white/10 rounded-2xl p-2 shadow-md w-full gap-2">
										<Search className="w-4 h-4 text-neutral-500 ml-1 flex-shrink-0" />
										<input
											type="text"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											placeholder="Search address or landmarks"
											className="bg-transparent text-xs text-white placeholder-neutral-500 w-full focus:outline-none"
										/>
										{loadingSuggestions ? (
											<LoaderCircle className="w-3.5 h-3.5 animate-spin text-neutral-500 mr-1 flex-shrink-0" />
										) : searchQuery.length > 0 ? (
											<button
												type="button"
												onClick={() => {
													setSearchQuery("");
													setSuggestions([]);
													setSearchError(null);
												}}
												className="text-neutral-500 hover:text-white mr-1 text-xs flex-shrink-0 cursor-pointer"
											>
												✕
											</button>
										) : null}
									</div>

									{/* Suggestion Dropdown */}
									{(suggestions.length > 0 || searchError) && (
										<div className="absolute top-full left-0 right-0 mt-1 bg-neutral-950/95 border border-white/10 rounded-2xl shadow-2xl max-h-[180px] overflow-y-auto z-30 flex flex-col">
											{suggestions.length > 0 ? (
												suggestions.map((item: any) => (
													<button
														key={item.place_id}
														type="button"
														onClick={() => selectSuggestion(item)}
														className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center gap-3 cursor-pointer"
													>
														<div className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-white flex-shrink-0">
															<MapPin className="w-3.5 h-3.5" />
														</div>
														<div className="flex flex-col overflow-hidden">
															<span className="text-xs font-bold text-white truncate">
																{item.structured_formatting?.main_text || item.description}
															</span>
															{item.structured_formatting?.secondary_text && (
																<span className="text-[10px] text-neutral-400 truncate">
																	{item.structured_formatting.secondary_text}
																</span>
															)}
														</div>
													</button>
												))
											) : (
												<div className="px-4 py-3 text-xs text-neutral-400 select-text">
													{searchError}
												</div>
											)}
										</div>
									)}
								</div>
							)}
							{coordError && (
								<div className="bg-rose-950/20 border border-rose-900/30 text-rose-400 px-3 py-1.5 rounded-xl text-[10px] font-bold self-start mt-0.5 select-text shadow-md">
									{coordError}
								</div>
							)}
						</div>

						{/* Google Map Area Wrapper */}
						<div className="w-full aspect-square bg-black rounded-3xl relative overflow-hidden border border-white/10 shadow-lg">
							<div ref={mapElementRef} className="absolute inset-0">
								<APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places"]}>
									<Map
										key="satellite-map-stable"
										defaultCenter={mapCenter}
										defaultZoom={19}
										mapTypeId="satellite"
										renderingType="RASTER"
										gestureHandling="greedy"
										disableDefaultUI
										className="w-[110%] h-[110%] absolute top-[-5%] left-[-5%]"
									>
										<MapInstanceHolder onLoad={handleMapLoad} />
									</Map>
								</APIProvider>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-3 mt-1">
							{!loading && (
								<button
									onClick={() => setView("selection")}
									className="flex-1 py-3 border border-white/20 hover:bg-white/10 text-neutral-400 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
								>
									<ArrowLeft className="w-3.5 h-3.5" />
									<span>Back</span>
								</button>
							)}
							<button
								onClick={handleConfirmLocation}
								disabled={loading}
								className="flex-grow py-3 bg-white hover:bg-neutral-200 disabled:bg-white/20 text-black font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 cursor-pointer border border-transparent"
							>
								{loading ? (
									<>
										<RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
										<span>Initializing Workspace...</span>
									</>
								) : (
									<>
										<span>Confirm Location & Create</span>
									</>
								)}
							</button>
						</div>
					</div>
				)}

			</div>
		</div>
	);
}
