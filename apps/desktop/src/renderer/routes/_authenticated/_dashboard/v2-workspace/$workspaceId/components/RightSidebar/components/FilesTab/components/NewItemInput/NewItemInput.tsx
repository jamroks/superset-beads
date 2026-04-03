import { useEffect, useRef, useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { FileIcon } from "renderer/screens/main/components/WorkspaceView/RightSidebar/FilesView/utils";

interface NewItemInputProps {
	mode: "file" | "folder";
	depth: number;
	indent: number;
	rowHeight: number;
	onSubmit: (name: string) => void;
	onCancel: () => void;
}

export function NewItemInput({
	mode,
	depth,
	indent,
	rowHeight,
	onSubmit,
	onCancel,
}: NewItemInputProps) {
	const [value, setValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const trimmed = value.trim();
			if (trimmed) onSubmit(trimmed);
		} else if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		}
	};

	// Derive the icon file name from the last segment of the input
	const displayName = value.includes("/")
		? (value.split("/").pop() ?? "")
		: value;

	return (
		<div
			data-new-item-input
			className="flex w-full items-center gap-1 px-1"
			style={{
				height: rowHeight,
				paddingLeft: 4 + depth * indent,
			}}
		>
			<span className="flex h-4 w-4 shrink-0 items-center justify-center">
				{mode === "folder" ? (
					<LuChevronDown className="size-3.5 text-muted-foreground" />
				) : null}
			</span>

			<FileIcon
				className="size-4 shrink-0"
				fileName={displayName || (mode === "folder" ? "folder" : "file")}
				isDirectory={mode === "folder"}
				isOpen={mode === "folder"}
			/>

			<input
				ref={inputRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				onBlur={onCancel}
				className="min-w-0 flex-1 bg-transparent text-xs outline-none ring-1 ring-ring rounded-sm px-1"
				style={{ height: rowHeight - 4 }}
			/>
		</div>
	);
}
