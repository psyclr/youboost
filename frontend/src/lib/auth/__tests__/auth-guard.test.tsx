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

import { AuthGuard } from '../auth-guard';

describe('AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show skeleton when loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to /login when no user', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', role: 'USER' },
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
