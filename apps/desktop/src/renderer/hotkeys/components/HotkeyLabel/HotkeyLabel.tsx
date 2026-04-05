import { Kbd, KbdGroup } from "@superset/ui/kbd";
import type { HotkeyId } from "../../registry";
import { useHotkeyDisplay } from "../../hooks/useHotkeyDisplay";

export function HotkeyLabel({ label, id }: { label: string; id: HotkeyId }) {
	const { keys } = useHotkeyDisplay(id);
	if (keys[0] === "Unassigned") return <span>{label}</span>;
	return (
		<span className="flex items-center gap-2">
			{label}
			<KbdGroup>
				{keys.map((k) => (
					<Kbd key={k}>{k}</Kbd>
				))}
			</KbdGroup>
		</span>
	);
}
