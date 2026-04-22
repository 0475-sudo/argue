type Argument = {
  id: string;
  stance: "for" | "against";
  content: string;
  evidence_url: string;
  evidence_description: string | null;
  created_at: string;
  profiles: { username: string } | null;
};

export default function ArgumentList({
  arguments: args,
}: {
  arguments: Argument[];
}) {
  const forArgs = args.filter((a) => a.stance === "for");
  const againstArgs = args.filter((a) => a.stance === "against");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 賛成側 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950">
        <h2 className="mb-4 text-lg font-semibold text-blue-800 dark:text-blue-200">
          同じです（{forArgs.length}）
        </h2>
        {forArgs.length === 0 ? (
          <p className="text-sm text-blue-600 dark:text-blue-400">
            まだ投稿がありません
          </p>
        ) : (
          <div className="space-y-4">
            {forArgs.map((arg) => (
              <ArgumentCard key={arg.id} argument={arg} variant="for" />
            ))}
          </div>
        )}
      </div>

      {/* 反対側 */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <h2 className="mb-4 text-lg font-semibold text-red-800 dark:text-red-200">
          ほかにもあります（{againstArgs.length}）
        </h2>
        {againstArgs.length === 0 ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            まだ投稿がありません
          </p>
        ) : (
          <div className="space-y-4">
            {againstArgs.map((arg) => (
              <ArgumentCard key={arg.id} argument={arg} variant="against" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArgumentCard({
  argument,
  variant,
}: {
  argument: Argument;
  variant: "for" | "against";
}) {
  const isFor = variant === "for";
  const borderColor = isFor
    ? "border-blue-200 dark:border-blue-800"
    : "border-red-200 dark:border-red-800";
  const bgColor = isFor
    ? "bg-white dark:bg-blue-900/30"
    : "bg-white dark:bg-red-900/30";
  const textColor = isFor
    ? "text-blue-900 dark:text-blue-100"
    : "text-red-900 dark:text-red-100";
  const metaColor = isFor
    ? "text-blue-600 dark:text-blue-400"
    : "text-red-600 dark:text-red-400";
  const linkColor = isFor
    ? "text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
    : "text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100";

  const displayName = argument.profiles?.username || "匿名ユーザー";
  const time = new Date(argument.created_at).toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4`}>
      <p className={`mb-3 text-sm ${textColor}`}>{argument.content}</p>
      <div
        className={`border-t ${borderColor} pt-2`}
      >
        <p className={`mb-1 text-xs font-medium ${metaColor}`}>根拠:</p>
        <a
          href={argument.evidence_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block truncate text-xs underline ${linkColor}`}
        >
          {argument.evidence_url}
        </a>
        {argument.evidence_description && (
          <p className={`mt-1 text-xs ${metaColor}`}>
            {argument.evidence_description}
          </p>
        )}
      </div>
      <div className={`mt-2 flex items-center justify-between text-xs ${metaColor}`}>
        <span>{displayName}</span>
        <span>{time}</span>
      </div>
    </div>
  );
}
