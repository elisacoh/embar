export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      {/* Wordmark */}
      <div className="mb-8 select-none">
        <span className="text-2xl font-semibold tracking-tight text-brand-600">Embar</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-background p-8">
        {children}
      </div>
    </div>
  );
}
