export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F1F7E4] to-[#FBFCFA] px-4 py-12">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
