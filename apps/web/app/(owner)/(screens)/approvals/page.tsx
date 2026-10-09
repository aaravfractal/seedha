import { ComingIn } from "@/components/States";

export default function Page() {
  return (
    <>
      <h2 className="title">Messages waiting for you.</h2>
      <ComingIn milestone="M6" what="Approvals" />
    </>
  );
}
