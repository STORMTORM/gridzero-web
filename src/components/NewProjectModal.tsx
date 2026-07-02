import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Box, FileText, ArrowRight, RefreshCw, ArrowLeft } from "lucide-react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { toBlob } from "html-to-image";
import api from "../api/client";

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
					setMapCenter({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					});
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
			const res = await api.post("/visit/file/upload", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});

			const sitevisitId = res.data?.sitevisit_id;
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
						
						{/* Google Map Area Wrapper */}
						<div className="w-full aspect-square bg-black rounded-3xl relative overflow-hidden border border-white/10 shadow-lg">
							
							{/* Large Google Map Element (100% size, fills the visible frame fully) */}
							<div ref={mapElementRef} className="absolute inset-0">
								<APIProvider apiKey="AIzaSyCYXGomZFJDmTKzz7GEElAQ_UeapHzDX7Q" libraries={["places"]}>
									<Map
										key={`${mapCenter.lat}-${mapCenter.lng}`}
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
