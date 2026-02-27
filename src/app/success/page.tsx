import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function SuccessPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                    <CheckCircle2 className="w-20 h-20 text-green-500" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Installation Successful!</h1>
                    <p className="text-zinc-400">
                        The Slack bot has been successfully installed to your workspace. You can now close this window and start using it in Slack!
                    </p>
                </div>
                <div className="pt-4">
                    <Link
                        href="/"
                        className="inline-flex h-10 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-black transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
