import { OperationsGuide } from "@/src/components/operations-guide";
import { OperationsWorkspace } from "@/src/components/operations-workspace";

export const metadata = { title: "Operations" };

export default function Page() {
  return (
    <>
      <OperationsGuide />
      <OperationsWorkspace />
    </>
  );
}
