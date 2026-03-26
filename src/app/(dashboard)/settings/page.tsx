"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Link, CheckCircle, Plus } from "lucide-react";

const SLACK_INSTALL_URL =
  "https://slack.com/oauth/v2/authorize?" +
  new URLSearchParams({
    client_id: "10612024734321.10597070809926",
    scope: "app_mentions:read,chat:write,commands,users:read,users:read.email,users.profile:read",
    redirect_uri: "https://task-manager-fawn-delta.vercel.app/api/slack/oauth/callback",
  }).toString();

export default function SettingsPage() {
  const { data: session } = useSession();
  const [slackUserId, setSlackUserId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);

  const user = session?.user as { id?: string; name?: string; email?: string; teamId?: string; slackId?: string } | undefined;
  const isLinked = !!(user as { teamId?: string })?.teamId;

  async function sendCode() {
    if (!slackUserId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/slack/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slackUserId: slackUserId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Verification code sent! Check your Slack DMs.");
      setStep("verify");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndLink() {
    if (!verifyCode.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/slack/link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setStep("input");
      setSlackUserId("");
      setVerifyCode("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Manage your account connections</p>
      </header>

      <div className="max-w-md flex flex-col gap-4">
        {/* Add to Slack workspace */}
        <div className="border rounded-lg p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold text-sm">Add to a Slack Workspace</h2>
            <p className="text-xs text-muted-foreground">
              Install the TaskBot into a new Slack workspace to start creating tasks from Slack.
            </p>
          </div>
          <a href={SLACK_INSTALL_URL}>
            <Button className="gap-2 w-full" variant="outline">
              <Plus className="h-4 w-4" />
              Add to Slack
            </Button>
          </a>
        </div>

        {/* Connect personal Slack account */}
        <div className="border rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold text-sm">Slack Account</h2>
              <p className="text-xs text-muted-foreground">
                {isLinked
                  ? "Your Slack account is connected. Tasks assigned to you in Slack will appear here."
                  : "Connect your Slack account to see tasks assigned to you in Slack."}
              </p>
            </div>
            {isLinked && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
          </div>

          {!isLinked && (
            <>
              {step === "input" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="slackUserId">Your Slack User ID</Label>
                    <p className="text-xs text-muted-foreground">
                      Find it in Slack: click your profile photo → <strong>Profile</strong> → click the three-dot menu → <strong>Copy member ID</strong>
                    </p>
                    <Input
                      id="slackUserId"
                      placeholder="e.g. U0AHHL5J0UD"
                      value={slackUserId}
                      onChange={e => setSlackUserId(e.target.value)}
                    />
                  </div>
                  <Button onClick={sendCode} disabled={loading || !slackUserId.trim()} className="w-full gap-2">
                    <Link className="h-4 w-4" />
                    {loading ? "Sending..." : "Send Verification Code"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="verifyCode">Verification Code</Label>
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code sent to you via Slack DM.
                    </p>
                    <Input
                      id="verifyCode"
                      placeholder="123456"
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value)}
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("input")} disabled={loading}>Back</Button>
                    <Button onClick={verifyAndLink} disabled={loading || verifyCode.length < 6} className="flex-1">
                      {loading ? "Verifying..." : "Verify & Connect"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

