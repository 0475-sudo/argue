import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DebateChat from "@/components/debate-chat";
import { findRelatedRooms } from "@/lib/related-rooms";

export default async function RoomPage(props: PageProps<"/room/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const merged = searchParams?.merged === "1";
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .single();

  if (!room) {
    notFound();
  }

  const { data: args } = await supabase
    .from("arguments")
    .select("*, profiles(username, display_name)")
    .eq("room_id", id)
    .order("created_at", { ascending: true });

  const { data: moderations } = await supabase
    .from("ai_moderations")
    .select("id, type, content, triggered_by, created_at")
    .eq("room_id", id)
    .neq("type", "rejection")
    .order("created_at", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userVotes: Record<string, 1 | -1> = {};
  if (user && args && args.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("argument_id, value")
      .eq("user_id", user.id)
      .in(
        "argument_id",
        args.map((a) => a.id)
      );
    if (votes) {
      userVotes = Object.fromEntries(
        votes.map((v) => [v.argument_id, v.value as 1 | -1])
      );
    }
  }

  const { data: candidateRooms } = await supabase
    .from("rooms")
    .select("id, title, source_url, source_url_normalized, status")
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const relatedRooms = findRelatedRooms(
    {
      id: room.id,
      title: room.title,
      source_url: room.source_url,
      source_url_normalized: room.source_url_normalized ?? null,
      status: room.status,
    },
    candidateRooms ?? [],
    5
  );

  const statusLabel: Record<string, { text: string; className: string }> = {
    open: {
      text: "募集中",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    active: {
      text: "進行中",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    closed: {
      text: "終了",
      className:
        "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    },
  };

  const status = statusLabel[room.status] ?? statusLabel.open;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {merged && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          この URL についてはすでに議論が進んでいたため、既存のルームにあなたの意見を追加しました。
        </div>
      )}

      {/* ルームヘッダー */}
      <div className="mb-6">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
        >
          {status.text}
        </span>
        <h1 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {room.title}
        </h1>
        {room.source_url && (
          <a
            href={room.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            元の投稿を見る
          </a>
        )}
      </div>

      {/* 関連ルーム */}
      {relatedRooms.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            関連するルーム
          </h2>
          <div className="space-y-1.5">
            {relatedRooms.map((r) => (
              <Link
                key={r.id}
                href={`/room/${r.id}`}
                className="block rounded-md border border-zinc-200 px-3 py-2 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <p className="line-clamp-1 text-sm text-zinc-800 dark:text-zinc-200">
                  {r.title}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">
                  {r.matchReason}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* チャット + フォーム */}
      <DebateChat
        roomId={id}
        roomTitle={room.title}
        roomStatus={room.status}
        initialArguments={args ?? []}
        initialModerations={moderations ?? []}
        initialUserVotes={userVotes}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
