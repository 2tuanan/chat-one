export default function ChatPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-zinc-900">
          Select a room to start chatting
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Pick a conversation from the sidebar or create a new room.
        </p>
      </div>
    </div>
  );
}
