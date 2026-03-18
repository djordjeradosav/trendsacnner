export function MacroSkeleton({ message }: { message?: string }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton rounded-lg h-[90px]" />
        ))}
      </div>
      <div className="skeleton rounded-lg h-[80px]" />
      <div className="skeleton rounded-lg h-[320px]" />
      <div className="skeleton rounded-lg h-[200px]" />
      {message && (
        <p className="text-center text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
