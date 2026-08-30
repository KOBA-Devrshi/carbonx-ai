"use client";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="py-24 flex flex-col items-center gap-3 text-textFaint">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      <div className="font-mono text-[12px]">{label}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-20 flex flex-col items-center gap-3 text-center max-w-md mx-auto">
      <div className="font-mono text-[11px] tracking-wide uppercase text-danger">CarbonX Intelligence Service Unavailable</div>
      <div className="text-textDim text-[13px]">{message}</div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm mt-2" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-16 text-center text-textFaint text-[13px]">{message}</div>;
}
