import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('should render the status text', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('should apply green classes for COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-green-100');
  });

  it('should apply red classes for FAILED status', () => {
    render(<StatusBadge status="FAILED" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-red-100');
  });

  it('should apply yellow classes for PENDING status', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('should handle unknown status with empty className', () => {
    render(<StatusBadge status={'UNKNOWN' as never} />);
    const badge = screen.getByTestId('badge');
    expect(badge).toBeInTheDocument();
  });
});
