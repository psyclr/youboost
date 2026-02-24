import React from 'react';
import { render, screen } from '@testing-library/react';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = jest.fn();
jest.mock('../auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

import { AdminGuard } from '../admin-guard';

describe('AdminGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show skeleton when loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should redirect to /login when no user', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should redirect to /dashboard for non-ADMIN user', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', role: 'USER' },
      isLoading: false,
    });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should render children for ADMIN user', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', role: 'ADMIN' },
      isLoading: false,
    });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
