import { useRef, useState } from "react";

interface CommentInputProps {
	placeholder?: string;
	onSubmit?: (comment: string) => void;
}

export function CommentInput({
	placeholder = "Leave a comment...",
	onSubmit,
}: CommentInputProps) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		// Auto-resize the textarea
		const textarea = e.target;
		textarea.style.height = "auto";
		textarea.style.height = `${textarea.scrollHeight}px`;
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleSubmit = () => {
		const trimmed = value.trim();
		if (!trimmed) return;
		onSubmit?.(trimmed);
		setValue("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	return (
		<div className="border border-border rounded-lg transition-colors focus-within:border-muted-foreground/50 hover:border-muted-foreground/50">
			<textarea
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				rows={1}
				className="w-full bg-transparent p-3 text-sm resize-none outline-none placeholder:text-muted-foreground"
			/>
			{value.trim().length > 0 && (
				<div className="flex justify-end px-3 pb-2">
					<button
						type="button"
						onClick={handleSubmit}
						className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						Comment
					</button>
				</div>
			)}
		</div>
	);
}
