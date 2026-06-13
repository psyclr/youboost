'use client';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { estimatePrice } from '@/lib/landings/calculator';
import { formatCurrency } from '@/lib/utils';
import type { CartItem as CartItemType } from '@/lib/landings/use-cart';

interface CartItemProps {
  item: CartItemType;
  onRemove: () => void;
  onToggle: () => void;
  onLink: (v: string) => void;
  onQuantity: (v: number) => void;
}

export function CartItem({ item, onRemove, onToggle, onLink, onQuantity }: CartItemProps) {
  const { tier } = item;
  const name = tier.titleOverride ?? tier.service.name;
  const price = estimatePrice(tier, item.quantity);
  return (
    <div className="overflow-hidden rounded-[3px] border" style={{ borderColor: '#363636' }}>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-semibold text-white">{name}</h4>
          {tier.service.description ? (
            <p className="truncate text-[12px] text-[#a2a2a2]">{tier.service.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[18px] font-bold text-white">{formatCurrency(price)}</span>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-label="Remove item"
              onClick={onRemove}
              className="rounded-[3px] border p-1.5 text-[#676767]"
              style={{ borderColor: '#363636' }}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={item.collapsed ? 'Expand item' : 'Collapse item'}
              onClick={onToggle}
              className="rounded-[3px] border p-1.5 text-[#676767]"
              style={{ borderColor: '#363636' }}
            >
              {item.collapsed ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      {item.collapsed ? null : (
        <div
          className="flex min-w-0 flex-col gap-3 overflow-hidden border-t px-3 py-3"
          style={{ borderColor: '#363636' }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-white">Add a link</span>
            <input
              type="text"
              value={item.link}
              onChange={(e) => onLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Add a link"
              className="w-full min-w-0 rounded-[3px] border px-3 py-2.5 text-[13px] text-white placeholder:text-[#676767] focus:outline-none"
              style={{ background: '#0a0a0a', borderColor: '#363636' }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-white">Quantity</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              // Digits only — strip anything else (minus, e, dot, spaces) so the
              // value is always a non-negative integer and never NaN. Cap at the
              // service max; the min is enforced on Pay with a clear message.
              value={item.quantity === 0 ? '' : String(item.quantity)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                onQuantity(digits === '' ? 0 : Math.min(Number(digits), tier.service.maxQuantity));
              }}
              aria-label="Quantity"
              className="w-full min-w-0 rounded-[3px] border px-3 py-2.5 text-[13px] text-white focus:outline-none"
              style={{ background: '#0a0a0a', borderColor: '#363636' }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
