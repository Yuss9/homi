import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, documents, homeMembers, homes, maintenanceRecords, maintenanceTasks, notificationPreferences, repairRecords, rooms, user } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
export async function GET(request: Request) {
  const id=requestId(request);
  try{
    const session=await requireVerifiedUser();
    const memberships=await db.select().from(homeMembers).where(eq(homeMembers.userId,session.user.id));
    const homeIds=memberships.map((item)=>item.homeId);
    const [profile]=await db.select({id:user.id,name:user.name,email:user.email,emailVerified:user.emailVerified,createdAt:user.createdAt}).from(user).where(eq(user.id,session.user.id)).limit(1);
    const homeData=await Promise.all(homeIds.map(async(homeId)=>({home:(await db.select().from(homes).where(eq(homes.id,homeId)).limit(1))[0],rooms:await db.select().from(rooms).where(eq(rooms.homeId,homeId)),assets:await db.select().from(assets).where(eq(assets.homeId,homeId)),tasks:await db.select().from(maintenanceTasks).where(eq(maintenanceTasks.homeId,homeId)),maintenance:await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.homeId,homeId)),repairs:await db.select().from(repairRecords).where(eq(repairRecords.homeId,homeId)),documents:await db.select().from(documents).where(eq(documents.homeId,homeId))})));
    const preferences=await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId,session.user.id));
    return new Response(JSON.stringify({exportedAt:new Date().toISOString(),profile,preferences,homes:homeData},null,2),{headers:{"Content-Type":"application/json","Content-Disposition":`attachment; filename="homi-export-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"private, no-store","X-Request-Id":id}});
  }catch(error){return errorResponse(error,id)}
}

