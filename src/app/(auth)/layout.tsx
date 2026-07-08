export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F1F7E4] to-[#FBFCFA] dark:from-[#0f1626] dark:to-[#10192b] px-4 py-12">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
