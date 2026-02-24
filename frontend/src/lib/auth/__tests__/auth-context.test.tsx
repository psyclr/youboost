import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';

const mockLogin = jest.fn();
const mockRefreshToken = jest.fn();
const mockGetMe = jest.fn();
const mockLogout = jest.fn();

jest.mock('@/lib/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
  getMe: (...args: unknown[]) => mockGetMe(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
}));

jest.mock('@/lib/api/client', () => ({
  setAuthHandlers: jest.fn(),
}));

const mockLocalStorage: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
    },
    writable: true,
  });
});

function TestConsumer() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading</div>;
  return <div>{user ? `User: ${user.username}` : 'No user'}</div>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  it('should throw when useAuth is used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });

  it('should start loading and resolve to no user when no refresh token', async () => {
    mockRefreshToken.mockRejectedValue(new Error('no token'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('Loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });
  });

  it('should set user after login', async () => {
    mockRefreshToken.mockRejectedValue(new Error('no token'));

    const mockUser = {
      userId: 'u1',
      email: 'test@test.com',
      username: 'testuser',
      role: 'USER',
      emailVerified: true,
      createdAt: '2024-01-01',
    };

    function LoginConsumer() {
      const { user, isLoading, login } = useAuth();
      if (isLoading) return <div>Loading</div>;
      return (
        <div>
          <span>{user ? `User: ${user.username}` : 'No user'}</span>
          <button onClick={() => login('test@test.com', 'password')}>Login</button>
        </div>
      );
    }

    mockLogin.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    mockGetMe.mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByText('User: testuser')).toBeInTheDocument();
    });
  });

  it('should clear user after logout', async () => {
    mockLocalStorage['youboost_refresh_token'] = 'stored-refresh';
    mockRefreshToken.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'new-refresh',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    mockGetMe.mockResolvedValue({
      userId: 'u1',
      email: 'test@test.com',
      username: 'testuser',
      role: 'USER',
      emailVerified: true,
      createdAt: '2024-01-01',
    });
    mockLogout.mockResolvedValue(undefined);

    function LogoutConsumer() {
      const { user, isLoading, logout } = useAuth();
      if (isLoading) return <div>Loading</div>;
      return (
        <div>
          <span>{user ? `User: ${user.username}` : 'No user'}</span>
          <button onClick={() => logout()}>Logout</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LogoutConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('User: testuser')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });
  });
});
