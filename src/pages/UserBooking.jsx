import PublicLayout from "../components/layout/PublicLayout";
import BookingNew from "./client/BookingNew";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../data/mockUsers";

/**
 * Booking wizard for a signed-up user whose booking has not been approved
 * yet (route "/book-room").
 *
 * It re-uses the exact same BookingNew wizard that approved clients use, but
 * shows it inside the PUBLIC layout instead of the Client Dashboard layout,
 * so the user never sees the dashboard sidebar or links. The dark wrapper
 * below just matches the background BookingNew's header is designed for
 * (the same one AppLayout gives it).
 */
export default function UserBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Admin approval changes this user's role across tabs. Move an already
  // signed-in customer into the Client Dashboard as soon as that happens.
  useEffect(() => {
    if (user?.role === ROLES.CLIENT) {
      navigate("/client/dashboard", { replace: true });
    }
  }, [user?.role, navigate]);

  return (
    <PublicLayout showFooter={false}>
      <div className="min-h-[70vh] bg-blueprint-bg blueprint-grid-bg">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <BookingNew />
        </div>
      </div>
    </PublicLayout>
  );
}
