import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";
import RoomCard from "../../components/booking/RoomCard";
import usePublicRooms from "../../hooks/usePublicRooms";
import { AMENITIES } from "../../data/mockRooms";
import { ROOM_TYPES, CAPACITY_RANGES, getRoomTypeId, popularityScore } from "../../utils/roomDisplay";
import { useAuth } from "../../context/AuthContext";
import { setPendingBookingRoomId, clientBookingPath } from "../../utils/pendingBookingStorage";

const SORT_OPTIONS = [
  { id: "popular", label: "Popular" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "capacity", label: "Capacity" },
];

const MAX_PRICE = 5000;

export default function Rooms() {
  const navigate = useNavigate();
  const { rooms, roomState } = usePublicRooms();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const [types, setTypes] = useState([]);
  const [capacities, setCapacities] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [sort, setSort] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const roomTypeFilter = searchParams.get("type");

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const filtered = useMemo(() => {
    let list = rooms.filter((room) => {
      if (types.length && !types.includes(getRoomTypeId(room))) return false;
      if (roomTypeFilter && getRoomTypeId(room) !== roomTypeFilter) return false;
      if (capacities.length) {
        const bucket = CAPACITY_RANGES.find((c) => c.test(room.capacity));
        if (!bucket || !capacities.includes(bucket.id)) return false;
      }
      if (amenities.length && !amenities.every((a) => room.includedAmenities.includes(a))) return false;
      if (room.pricePerHour > maxPrice) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.pricePerHour - b.pricePerHour;
      if (sort === "price-desc") return b.pricePerHour - a.pricePerHour;
      if (sort === "capacity") return b.capacity - a.capacity;
      return popularityScore(b) - popularityScore(a);
    });

    return list;
  }, [rooms, types, roomTypeFilter, capacities, amenities, maxPrice, sort]);

  function handleViewDetails(roomId) {
    navigate(`/rooms/${roomId}`);
  }

  // Signed-in users go straight to the client booking wizard with this
  // room pre-selected; signed-out visitors create an account first, with
  // the room id preserved via pendingBookingRoomId (see Signup.jsx/Login.jsx).
  function handleBookNow(roomId) {
    if (isAuthenticated) {
      navigate(clientBookingPath(roomId));
      return;
    }
    setPendingBookingRoomId(roomId);
    navigate("/signup");
  }

  const activeFilterCount = types.length + capacities.length + amenities.length + (maxPrice < MAX_PRICE ? 1 : 0);

  return (
    <PublicLayout>
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="mb-2 font-mono text-xs tracking-[0.25em] text-indigo-500">BROWSE THE CATALOG</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">All Rooms</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Filter by type, capacity, amenities and price to find the right space for your next meeting,
            training session or event.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <Icon name="tag" className="h-4 w-4" />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <SortSelect sort={sort} setSort={setSort} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
              <FilterGroup title="Room Type">
                {ROOM_TYPES.map((t) => (
                  <CheckboxRow
                    key={t.id}
                    label={t.label}
                    checked={types.includes(t.id)}
                    onChange={() => toggle(types, setTypes, t.id)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Capacity">
                {CAPACITY_RANGES.map((c) => (
                  <CheckboxRow
                    key={c.id}
                    label={c.label}
                    checked={capacities.includes(c.id)}
                    onChange={() => toggle(capacities, setCapacities, c.id)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Amenities">
                {AMENITIES.map((a) => (
                  <CheckboxRow
                    key={a.id}
                    label={a.label}
                    checked={amenities.includes(a.id)}
                    onChange={() => toggle(amenities, setAmenities, a.id)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Max Price / hour">
                <input
                  type="range"
                  min={200}
                  max={MAX_PRICE}
                  step={100}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <p className="mt-1 text-xs text-slate-500">Up to ₹{maxPrice.toLocaleString("en-IN")}/hr</p>
              </FilterGroup>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTypes([]);
                    setCapacities([]);
                    setAmenities([]);
                    setMaxPrice(MAX_PRICE);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </aside>

          <div>
            <div className="mb-4 hidden items-center justify-between lg:flex">
              <p className="text-sm text-slate-500">
                {filtered.length} room{filtered.length === 1 ? "" : "s"} found
              </p>
              <SortSelect sort={sort} setSort={setSort} />
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500">
                No rooms match your filters. Try widening your search.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((room) => {
                  const state = roomState[room.id];
                  return (
                    <RoomCard
                      key={room.id}
                      room={room}
                      availabilityStatus={state?.availability.status}
                      issueWarning={state?.worstIssue}
                      onViewDetails={handleViewDetails}
                      onBookNow={handleBookNow}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function SortSelect({ sort, setSort }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      Sort by
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckboxRow({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  );
}
