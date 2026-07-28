import { redirect } from "next/navigation";
import { AuthShell } from "@/src/components/auth-shell";
import { AcceptInvitation } from "@/src/components/accept-invitation";
import { requireVerifiedUser } from "@/src/server/authorization";
export const metadata={title:"Household invitation",robots:{index:false,follow:false}}; export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;try{await requireVerifiedUser()}catch{redirect(`/sign-in?returnTo=${encodeURIComponent(`/invite/${token}`)}`)}return <AuthShell><div className="auth-card"><p className="section-kicker">Household invitation</p><h1>You’ve been invited home.</h1><p className="auth-subtitle">Accept to see the shared home with the permissions chosen by its owner.</p><AcceptInvitation token={token}/></div></AuthShell>}

