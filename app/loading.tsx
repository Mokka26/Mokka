import TypographicLoader from "@/components/TypographicLoader";

export default function Loading() {
  return (
    <div className="pt-32 lg:pt-40 pb-24">
      <TypographicLoader label="Een ogenblik" number="01" minHeight="60vh" />
    </div>
  );
}
