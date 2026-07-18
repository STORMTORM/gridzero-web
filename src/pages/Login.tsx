import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, RefreshCw, AlertCircle } from "lucide-react";
import api, { saveTokens } from "../api/client";

export default function Login() {
	const navigate = useNavigate();
	const [step, setStep] = useState<"phone" | "otp">("phone");
	const [phone, setPhone] = useState("");
	const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
	
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [timer, setTimer] = useState(60);

	const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

	// Redirect to dashboard if already authenticated
	useEffect(() => {
		if (localStorage.getItem("access_token")) {
			navigate("/");
		}
	}, [navigate]);

	// OTP Resend Countdown Timer
	useEffect(() => {
		if (step !== "otp") return;
		setTimer(60);
		const interval = setInterval(() => {
			setTimer((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [step]);

	const cleanPhone = (num: string) => {
		let cleaned = num.replace(/\D/g, "");
		if (cleaned.length > 10) cleaned = cleaned.slice(-10);
		if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
		return cleaned;
	};

	const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setPhone(cleanPhone(val));
		setError("");
	};

	const handleSendOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		if (phone.length !== 10) {
			setError("Please enter a valid 10-digit phone number");
			return;
		}

		setLoading(true);
		setError("");

		try {
			await api.post("/auth/login", {
				phone: Number(phone),
			});
			setStep("otp");
		} catch (err: any) {
			console.error("Failed to send OTP", err);
			setError(err?.response?.data?.detail || err?.message || "Failed to send verification code. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleOtpChange = (index: number, value: string) => {
		const val = value.replace(/\D/g, "").slice(-1);
		const nextOtp = [...otp];
		nextOtp[index] = val;
		setOtp(nextOtp);
		setError("");

		if (val && index < 5) {
			otpRefs.current[index + 1]?.focus();
		}
	};

	const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Backspace" && !otp[index] && index > 0) {
			otpRefs.current[index - 1]?.focus();
		}
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		const otpString = otp.join("");
		if (otpString.length !== 6) {
			setError("Verification code must be 6 digits");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const res = await api.post("/auth/verify-otp", {
				phone: Number(phone),
				otp: Number(otpString),
			});
			
			const { access_token, refresh_token, first_name, last_name } = res.data;
			if (!access_token || !refresh_token) {
				throw new Error("Invalid session tokens returned by server.");
			}

			saveTokens(access_token, refresh_token);
			localStorage.setItem("first_name", first_name || "Aditya");
			localStorage.setItem("last_name", last_name || "Sen");
			
			navigate("/");
		} catch (err: any) {
			console.error("Failed to verify OTP", err);
			setError(err?.response?.data?.detail || err?.message || "Invalid verification code. Please check and try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleResendCode = async () => {
		if (timer > 0) return;
		setLoading(true);
		setError("");
		try {
			await api.post("/auth/login", {
				phone: Number(phone),
			});
			setOtp(Array(6).fill(""));
			setTimer(60);
			otpRefs.current[0]?.focus();
		} catch (err: any) {
			setError(err?.response?.data?.detail || err?.message || "Failed to resend code.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col md:flex-row bg-background font-sans text-text">
			
			{/* LEFT PANEL: Branding & Visuals */}
			<div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-card p-12 border-b md:border-b-0 md:border-r border-border min-h-[40vh] md:min-h-screen">
				<div className="flex flex-col items-center text-center">
					{/* Official Logo Image */}
					<img src="https://gridzero.in/gridzero-logo.png" alt="GridZero Logo" className="w-24 h-24 object-contain" />
					{/* Logo Name & Slogan */}
					<h1 className="text-4xl font-extrabold text-text tracking-tight mt-6">
						GridZero
					</h1>
					<p className="text-placeholder text-xs mt-2 uppercase tracking-widest font-semibold">
						Solar Workspace Cockpit
					</p>
				</div>
			</div>

			{/* RIGHT PANEL: Authentication Form */}
			<div className="flex-grow flex items-center justify-center bg-background p-8 md:p-12 min-h-[60vh] md:min-h-screen">
				
				{/* Login Card wrapper */}
				<div className="w-full max-w-[420px] bg-card border border-border p-10 rounded-2xl shadow-2xl flex flex-col gap-6 relative z-10 animate-in fade-in duration-300">
					
					{/* Header label info */}
					<div className="flex flex-col gap-1.5">
						<h2 className="text-2xl font-bold text-text tracking-tight">
							Login
						</h2>
						<p className="text-xs text-placeholder font-medium leading-relaxed">
							{step === "phone" 
								? "Enter your registered mobile number to continue."
								: "Enter the 6-digit verification code sent to your mobile number."}
						</p>
					</div>

					{/* Error display banner */}
					{error && (
						<div className="bg-rose-950/20 border border-rose-900/30 text-rose-300 p-3 rounded-xl flex items-start gap-2 text-xs font-semibold">
							<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-455" />
							<span>{error}</span>
						</div>
					)}

					{/* STEP 1: Mobile Phone input details */}
					{step === "phone" && (
						<form onSubmit={handleSendOtp} className="flex flex-col gap-5">
							<div className="flex gap-2">
								{/* Country Flag Dropdown */}
								<div className="flex items-center gap-1 bg-background border border-border px-3.5 py-3.5 rounded-xl text-xs font-bold text-text select-none">
									<span>🇮🇳</span>
									<span className="ml-1">+91</span>
									<ChevronDown className="w-3.5 h-3.5 text-placeholder" />
								</div>

								{/* Mobile Input field */}
								<input
									type="tel"
									value={phone}
									onChange={handlePhoneChange}
									placeholder="Mobile Number"
									required
									disabled={loading}
									className="flex-grow bg-background border border-border px-4 py-3.5 rounded-xl text-xs font-bold text-text placeholder-placeholder focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
								/>
							</div>

							<button
								type="submit"
								disabled={loading || phone.length !== 10}
								className="w-full py-3.5 bg-primary hover:opacity-90 disabled:bg-primary/20 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center"
							>
								{loading ? (
									<RefreshCw className="w-4 h-4 animate-spin text-white" />
								) : (
									"Send OTP"
								)}
							</button>
						</form>
					)}

					{/* STEP 2: SMS Verification Inputs */}
					{step === "otp" && (
						<form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
							{/* Pin Input boxes */}
							<div className="grid grid-cols-6 gap-2">
								{otp.map((digit, index) => (
									<input
										key={index}
										ref={(el) => { otpRefs.current[index] = el; }}
										type="text"
										maxLength={1}
										value={digit}
										onChange={(e) => handleOtpChange(index, e.target.value)}
										onKeyDown={(e) => handleOtpKeyDown(index, e)}
										disabled={loading}
										className="aspect-square bg-background border border-border rounded-xl text-center text-base font-extrabold text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
									/>
								))}
							</div>

							<div className="flex flex-col gap-4">
								<button
									type="submit"
									disabled={loading || otp.join("").length !== 6}
									className="w-full py-3.5 bg-primary hover:opacity-90 disabled:bg-primary/20 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center"
								>
									{loading ? (
										<RefreshCw className="w-4 h-4 animate-spin text-white" />
									) : (
										"Verify OTP"
									)}
								</button>

								<div className="flex items-center justify-between text-[11px] font-semibold text-placeholder px-1">
									<button
										type="button"
										onClick={() => setStep("phone")}
										className="text-placeholder hover:text-text transition-colors cursor-pointer"
									>
										Edit Phone
									</button>

									{timer > 0 ? (
										<span>
											Resend in <strong className="text-text">{timer}s</strong>
										</span>
									) : (
										<button
											type="button"
											onClick={handleResendCode}
											className="text-primary hover:underline cursor-pointer"
										>
											Resend Code
										</button>
									)}
								</div>
							</div>
						</form>
					)}

				</div>

			</div>
		</div>
	);
}
