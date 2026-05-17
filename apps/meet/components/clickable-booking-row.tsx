'use client';

import { useState, type ReactNode } from 'react';
import {
  BookingDetailsDialog,
  type BookingForDialog,
} from './booking-details-dialog';

/**
 * Wraps a server-rendered booking row in a click handler that opens the
 * shared {@link BookingDetailsDialog}. The row markup itself is passed
 * as children so each surface (Dashboard "Next up", Bookings list,
 * Contacts popup list) can keep its own visual treatment.
 */
export function ClickableBookingRow({
  booking,
  as = 'li',
  className,
  children,
}: {
  booking: BookingForDialog;
  as?: 'li' | 'div';
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Tag = as;
  return (
    <>
      <Tag
        onClick={() => setOpen(true)}
        className={`${className ?? ''} cursor-pointer hover:bg-surface-sunken transition-colors`}
      >
        {children}
      </Tag>
      <BookingDetailsDialog booking={booking} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
