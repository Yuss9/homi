"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter(); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  return <div><button className="button button-large" disabled={loading} onClick={async()=>{setLoading(true);const response=await fetch("/api/invitations/accept",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});const data=await response.json();if(response.ok)router.push("/dashboard");else{setError(data.error?.message??"Could not accept invitation.");setLoading(false)}}}>{loading?"Joining…":"Join household"}</button>{error&&<p className="form-error">{error}</p>}</div>;
}

