import { PublicBookingApp } from "./PublicBookingApp";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicBookingApp slug={slug} />;
}
