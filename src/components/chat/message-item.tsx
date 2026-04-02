import { AlertTriangle, Loader2, RefreshCcw } from "lucide-react";
import type { MessageStatus, MessageWithProfile, OptimisticMessage } from "@/types/messages";

type MessageItemProps = {
  message: MessageWithProfile | OptimisticMessage;
  isOwn: boolean;
  onRetry?: (tempId: string, content: string) => void;
};

const isOptimistic = (
  message: MessageWithProfile | OptimisticMessage,
): message is OptimisticMessage => "temp_id" in message;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let duration = seconds;

  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return rtf.format(duration, unit);
    }

    duration = Math.round(duration / amount);
  }

  return rtf.format(duration, "year");
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .join("");

export default function MessageItem({ message, isOwn, onRetry }: MessageItemProps) {
  const senderName = message.sender.display_name || message.sender.username;
  const initials = getInitials(senderName);
  const status: MessageStatus = isOptimistic(message)
    ? message.status
    : "sent";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[75%] gap-3 rounded-2xl px-4 py-3 shadow-sm ${
          isOwn
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-900"
        }`}
      >
        {!isOwn ? (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700">
            {initials || "?"}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              {isOwn ? "You" : senderName}
            </p>
            <span
              className={`text-xs ${
                isOwn ? "text-zinc-300" : "text-zinc-500"
              }`}
              title={new Date(message.created_at).toLocaleString()}
            >
              {formatRelativeTime(message.created_at)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
          {status === "sending" ? (
            <div className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sending
            </div>
          ) : null}
          {status === "error" && isOptimistic(message) ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-rose-200">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
              <span className="text-rose-200">Failed to send.</span>
              {onRetry ? (
                <button
                  type="button"
                  onClick={() => onRetry(message.temp_id, message.content)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200/40 px-2 py-0.5 text-rose-100 transition hover:border-rose-200/70"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
