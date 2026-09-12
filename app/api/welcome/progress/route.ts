import { logAppError } from "@/lib/app-errors";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, getCurrentUserContext } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOAuthSignupProofSecret } from "@/lib/security-env";
import { isDemoMode } from "@/lib/app-mode";
import { readJsonObject } from "@/lib/request-validation";
import { isWelcomeTopic, sampleXp } from "@/features/entry/topics";
import { entryCopy } from "@/features/entry/copy";
import { decodeReceipt, encodeReceipt, newReceipt, receiptCookie, receiptLifetime } from "@/features/entry/receipt";
import { isSameOrigin } from "@/features/entry/request-origin";
import { progressAckCookie, progressPendingCookie, progressRevision } from "@/features/entry/progress-sync";
const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: receiptLifetime };
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"), `${request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")}:`)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const secret = getOAuthSignupProofSecret();
    const existing = decodeReceipt(request.cookies.get(receiptCookie)?.value, secret);
    const { action, topic, answer } = parsed.data;
    if (action === "claim") {
      const { user } = await getCurrentUserProfile();
      if (!user) return NextResponse.json({ error: "Sign in to save your progress." }, { status: 401 });
      if (!existing?.completed.length) {
        const response = NextResponse.json({ savedXp: 0, awardedXp: 0, completed: [] });
        const hint = request.cookies.get(progressPendingCookie)?.value;
        if (hint && hint.length < 256) response.cookies.set(progressAckCookie, hint, { ...options, httpOnly: false });
        return response;
      }
      if (isDemoMode) return NextResponse.json({ error: "Demo progress cannot be saved to a live account." }, { status: 409 });
      const { data, error } = await createSupabaseAdminClient().rpc("service_claim_welcome_progress", { p_user_id: user.id, p_receipt_id: existing.id, p_topics: existing.completed });
      if (error) {
        logAppError(new Error("Welcome claim RPC failed."), {operation: "welcome.progress.claim", metadata: {code: error.code}});
        const response = NextResponse.json({ error: "Your progress could not be saved. Please try again." }, { status: error.code === "42501" ? 403 : 503 });
        // A receipt belongs to one account. Retire only this snapshot if another
        // account already claimed it; a future lesson gets a fresh receipt.
        if (error.code === "42501" && error.message === "Receipt already claimed.") {
          response.cookies.set(progressAckCookie, progressRevision(existing), { ...options, httpOnly: false });
        }
        return response;
      }
      const response = NextResponse.json({...data as object, completed: existing.completed});
      response.cookies.set(progressAckCookie, progressRevision(existing), { ...options, httpOnly: false });
      return response;
    }
    if (!isWelcomeTopic(topic) || !["learn", "answer"].includes(String(action))) return NextResponse.json({ error: "Choose a sample lesson." }, { status: 400 });
    const acknowledged = existing && request.cookies.get(progressAckCookie)?.value === progressRevision(existing);
    const receipt = existing && !acknowledged ? existing : {...newReceipt(), learned: existing?.learned ?? []};
    if (action === "learn") {
      receipt.learned = [...new Set([...receipt.learned, topic])];
      const response = NextResponse.json({ completed: receipt.completed, xp: receipt.completed.length * sampleXp });
      response.cookies.set(receiptCookie, encodeReceipt(receipt, secret), options);
      if (receipt.completed.length) response.cookies.set(progressPendingCookie, progressRevision(receipt), { ...options, httpOnly: false });
      return response;
    }
    if (!receipt.learned.includes(topic) || (answer !== 0 && answer !== 1)) return NextResponse.json({ error: "Read the lesson before answering." }, { status: 400 });
    const correct = answer === 1;
    let alreadySaved = false;
    // One bounded, RLS-scoped read avoids promising a second award after a saved lesson.
    if (correct && !isDemoMode) {
      const { user, supabase } = await getCurrentUserContext();
      if (user && supabase) {
        const { data, error } = await supabase.from("xp_transactions").select("award_scope")
          .eq("user_id", user.id).eq("award_scope", `welcome:${topic}`).limit(1);
        if (error) throw error;
        alreadySaved = Boolean(data?.length);
      }
    }
    const alreadyEarned = alreadySaved || receipt.completed.includes(topic);
    if (correct && !alreadySaved) receipt.completed = [...new Set([...receipt.completed, topic])];
    const kind = correct ? "correct" : "incorrect";
    const heading = entryCopy[`SAMPLE.${topic}.feedback.${kind}.heading`];
    const response = NextResponse.json({ correct, alreadyEarned, alreadySaved, xp: receipt.completed.length * sampleXp, heading: entryCopy[correct ? "QUIZ.correctPrefix" : "QUIZ.incorrectPrefix"].replace("{feedbackHeading}", heading), body: entryCopy[`SAMPLE.${topic}.feedback.${kind}.body`] });
    response.cookies.set(receiptCookie, encodeReceipt(receipt, secret), options);
    if (receipt.completed.length) response.cookies.set(progressPendingCookie, progressRevision(receipt), { ...options, httpOnly: false });
    return response;
  } catch {
    logAppError(new Error("Welcome progress dependency unavailable."), {operation: "welcome.progress"});
    return NextResponse.json({ error: "Progress is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
