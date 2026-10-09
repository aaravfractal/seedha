import { ComingIn } from "@/components/States";

export default function Page() {
  return (
    <>
      <h2 className="title">Guests you paid for twice.</h2>
      <ComingIn milestone="M4" what="Repeat guests" />
    </>
  );
}
