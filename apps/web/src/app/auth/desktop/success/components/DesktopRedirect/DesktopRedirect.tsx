"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

export function DesktopRedirect({
	url,
	localCallbackUrl,
}: {
	url: string;
	localCallbackUrl?: string;
}) {
	useEffect(() => {
		if (localCallbackUrl) {
			window.location.href = localCallbackUrl;
		} else {
			window.location.href = url;
		}
	}, [url, localCallbackUrl]);

	return (
		<div className="flex flex-col items-center gap-8">
			<Image src="/title.svg" alt="Superset" width={180} height={56} priority />

			<div className="flex flex-col items-center gap-3">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
				<h1 className="text-xl font-semibold">You're all set!</h1>
				<p className="text-sm text-muted-foreground">Opening Superset...</p>
			</div>

			<Link
				href={localCallbackUrl ?? url}
				className="text-sm text-muted-foreground/70 underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-muted-foreground"
			>
				Click here if not redirected
			</Link>
		</div>
	);
}
