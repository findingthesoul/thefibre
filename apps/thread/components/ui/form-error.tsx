import { AlertCircle } from 'lucide-react';

/** The error line in a dialog's footer.
 *
 *  It used to be `truncate max-w-xs`, which cut every message off at roughly
 *  half a sentence — the reason a failed save read as
 *  `new row for relation "thread_engagement" viola…` and told nobody
 *  anything. The message wraps now; the footer grows a line instead. */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      title={message}
      className="mr-auto flex min-w-0 items-start gap-1.5 text-sm text-red-700"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{message}</span>
    </p>
  );
}
