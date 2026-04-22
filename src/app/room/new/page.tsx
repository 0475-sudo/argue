import RoomForm from "@/components/room-form";

export default function NewRoomPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        ディベートルームを作成
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        議論したいSNSの投稿URLを入力し、あなたの意見を最初に投稿してください。
      </p>
      <RoomForm />
    </div>
  );
}
