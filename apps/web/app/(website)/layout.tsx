import { WebsiteFrame } from "@/components/website/WebsiteFrame";

/** Public website and its legal pages: own header, main landmark and footer. */
export default function WebsiteLayout({ children }: LayoutProps<"/">) {
  return <WebsiteFrame>{children}</WebsiteFrame>;
}
