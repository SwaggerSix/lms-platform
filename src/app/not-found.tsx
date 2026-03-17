import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <FileQuestion className="mx-auto h-16 w-16 text-gray-400" />
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <h2 className="text-xl font-semibold text-gray-700">Page not found</h2>
        <p className="text-gray-500 max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
