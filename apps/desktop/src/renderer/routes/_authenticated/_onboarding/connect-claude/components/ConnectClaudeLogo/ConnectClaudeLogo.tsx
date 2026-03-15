export function ConnectClaudeLogo() {
	return (
		<div className="flex items-center justify-center mb-6">
			<div className="relative flex items-center">
				{/* Superset logo circle */}
				<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
					<svg
						width="24"
						height="24"
						viewBox="0 0 28 46"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-label="Superset"
					>
						<title>Superset</title>
						<path
							d="M18.1818 0H27.2727V9.09091H18.1818V0ZM9.09091 0H18.1818V9.09091H9.09091V0ZM0 9.09091H9.09091V18.1818H0V9.09091ZM0 18.1818H9.09091V27.2727H0V18.1818ZM9.09091 18.1818H18.1818V27.2727H9.09091V18.1818ZM18.1818 18.1818H27.2727V27.2727H18.1818V18.1818ZM18.1818 27.2727H27.2727V36.3636H18.1818V27.2727ZM18.1818 36.3636H27.2727V45.4545H18.1818V36.3636ZM9.09091 36.3636H18.1818V45.4545H9.09091V36.3636ZM0 36.3636H9.09091V45.4545H0V36.3636ZM0 0H9.09091V9.09091H0V0Z"
							fill="currentColor"
						/>
					</svg>
				</div>
				{/* Claude logo circle - overlapping */}
				<div className="-ml-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E87443] text-white border-2 border-background">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-label="Claude"
					>
						<title>Claude</title>
						<path
							d="M16.5 3.5L12 12L7.5 3.5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M12 12L16.5 20.5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M12 12L7.5 20.5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			</div>
		</div>
	);
}
