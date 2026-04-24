export function EmptyState() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center max-w-md px-6">
        <div className="text-[15px] text-text">
          Paste a CSV and click Analyze
        </div>
        <div className="text-[12px] text-textDim">
          Sample data is pre-loaded — just hit Analyze to see it run.
        </div>
      </div>
    </div>
  );
}
