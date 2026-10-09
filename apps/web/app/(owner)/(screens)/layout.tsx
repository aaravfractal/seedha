import { OwnerSidebar } from "@/components/OwnerSidebar";

export default function OwnerScreensLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="owner">
      <OwnerSidebar />
      <div className="view">{children}</div>
    </div>
  );
}
