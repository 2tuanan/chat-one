import type { TypingUser } from "@/types/messages";

type TypingIndicatorProps = {
  typingUsers: TypingUser[];
};

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  let text: string;
  if (typingUsers.length === 1) {
    text = `${typingUsers[0].username} is typing...`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
  } else {
    text = "Several people are typing...";
  }

  return (
    <p className="px-6 py-1 text-xs text-zinc-400 italic min-h-[24px]">
      {text}
    </p>
  );
}
