import Link from 'next/link';

/**
 * Shared "insufficient balance" note with a link to the deposit page.
 * Used by both the single and bulk order forms.
 */
export function InsufficientBalanceNote() {
  return (
    <p className="text-xs text-destructive">
      Insufficient balance.{' '}
      <Link href="/billing/deposit" className="underline">
        Add funds
      </Link>
    </p>
  );
}
