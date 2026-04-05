"use client";

import { useState } from "react";
import { authClient } from "@superset/auth/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function DeviceAuthPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const userCodeParam = searchParams.get("user_code");

	const [userCode, setUserCode] = useState(userCodeParam ?? "");
	const [status, setStatus] = useState<
		"idle" | "verifying" | "approving" | "approved" | "denied" | "error"
	>(userCodeParam ? "verifying" : "idle");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const code = userCode.replace(/[-\s]/g, "").toUpperCase();
		if (!code) return;

		setStatus("verifying");
		setError(null);

		try {
			// Verify the code is valid
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/auth/device/verify?user_code=${encodeURIComponent(code)}`,
			);

			if (!res.ok) {
				const data = await res.json();
				setError(data.message ?? "Invalid or expired code");
				setStatus("error");
				return;
			}

			setStatus("approving");
		} catch {
			setError("Failed to verify code");
			setStatus("error");
		}
	};

	const handleApprove = async () => {
		const code = userCode.replace(/[-\s]/g, "").toUpperCase();
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/auth/device/approve`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ userCode: code }),
				},
			);

			if (!res.ok) {
				const data = await res.json();
				setError(data.message ?? "Failed to approve");
				setStatus("error");
				return;
			}

			setStatus("approved");
		} catch {
			setError("Failed to approve");
			setStatus("error");
		}
	};

	const handleDeny = async () => {
		const code = userCode.replace(/[-\s]/g, "").toUpperCase();
		try {
			await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/auth/device/deny`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ userCode: code }),
				},
			);
			setStatus("denied");
		} catch {
			setStatus("denied");
		}
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Device Authorization</h1>
					<p className="mt-2 text-muted-foreground">
						Authorize the Superset CLI to access your account.
					</p>
				</div>

				{status === "idle" && (
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="code"
								className="block text-sm font-medium text-foreground"
							>
								Enter the code shown in your terminal
							</label>
							<input
								id="code"
								type="text"
								value={userCode}
								onChange={(e) => setUserCode(e.target.value)}
								placeholder="ABCD-EFGH"
								className="mt-1 block w-full rounded-md border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-widest placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								autoFocus
								autoComplete="off"
							/>
						</div>
						<button
							type="submit"
							className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							Continue
						</button>
					</form>
				)}

				{status === "verifying" && (
					<div className="text-center">
						<p className="text-muted-foreground">Verifying code...</p>
					</div>
				)}

				{status === "approving" && (
					<div className="space-y-4">
						<p className="text-center text-sm text-muted-foreground">
							The Superset CLI is requesting access to your account.
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={handleDeny}
								className="flex-1 rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
							>
								Deny
							</button>
							<button
								type="button"
								onClick={handleApprove}
								className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
							>
								Authorize
							</button>
						</div>
					</div>
				)}

				{status === "approved" && (
					<div className="text-center">
						<p className="text-xl font-medium text-green-500">Authorized!</p>
						<p className="mt-2 text-muted-foreground">
							You can close this tab and return to the terminal.
						</p>
					</div>
				)}

				{status === "denied" && (
					<div className="text-center">
						<p className="text-xl font-medium text-red-500">Denied</p>
						<p className="mt-2 text-muted-foreground">
							Authorization was denied. You can close this tab.
						</p>
					</div>
				)}

				{status === "error" && (
					<div className="space-y-4 text-center">
						<p className="text-red-500">{error}</p>
						<button
							type="button"
							onClick={() => {
								setStatus("idle");
								setError(null);
							}}
							className="text-sm text-muted-foreground underline hover:text-foreground"
						>
							Try again
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
