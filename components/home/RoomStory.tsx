import { HOME_ROOMS } from "@/lib/home-scenes";
import { getProductCounts } from "@/lib/product-counts";
import { RoomScenes, type RoomSceneData } from "@/components/home/RoomScenes";

// Server component: haalt de aantallen op en geeft de kamers door aan de
// client-component die het vaststaande beeld wisselt tijdens het scrollen.
// DB onbereikbaar → zonder aantallen, de sectie blijft staan.
export async function RoomStory() {
  let counts: Record<string, number> = {};
  try {
    counts = await getProductCounts();
  } catch {
    counts = {};
  }

  const rooms: RoomSceneData[] = HOME_ROOMS.map((r) => ({ ...r, count: counts[r.category] ?? 0 }));

  return (
    <section className="py-20 lg:py-32 bg-paper" aria-labelledby="rooms-heading">
      <div className="max-w-page mx-auto px-6 sm:px-10 lg:px-14">
        <div className="max-w-3xl mb-12 lg:mb-8 reveal">
          <p className="text-sm font-medium uppercase tracking-label text-accent-dark mb-4">Inspiratie</p>
          <h2 id="rooms-heading" className="display-lg text-ink">
            Kamer voor kamer
          </h2>
        </div>
        <RoomScenes rooms={rooms} />
      </div>
    </section>
  );
}
