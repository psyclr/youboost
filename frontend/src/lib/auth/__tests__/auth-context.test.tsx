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

const mockUser = {
  userId: 'u1',
  email: 'test@test.com',
  username: 'testuser',
  role: 'USER',
  emailVerified: true,
  createdAt: '2024-01-01',
};

const mockLocalStorage: Record<string, string> = {};
const removeItemSpy = jest.fn((key: string) => {
  delete mockLocalStorage[key];
});
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: removeItemSpy,
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

  it('should resolve to no user when the refresh cookie is absent/invalid', async () => {
    // No valid cookie -> the refresh endpoint returns null.
    mockRefreshToken.mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('Loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });

    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it('should restore the session from the refresh cookie on bootstrap', async () => {
    // A valid cookie -> the refresh endpoint returns an access token.
    mockRefreshToken.mockResolvedValue({
      accessToken: 'token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    mockGetMe.mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('User: testuser')).toBeInTheDocument();
    });
  });

  it('should clear any stale legacy refresh token from localStorage on bootstrap', async () => {
    mockRefreshToken.mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });

    expect(removeItemSpy).toHaveBeenCalledWith('youboost_refresh_token');
  });

  it('should set user after login without persisting a refresh token', async () => {
    mockRefreshToken.mockResolvedValue(null);

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

    // The login response no longer carries a refresh token (cookie-based now).
    mockLogin.mockResolvedValue({ accessToken: 'token', expiresIn: 3600, tokenType: 'Bearer' });
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

    // No refresh token should be written to localStorage under any key.
    expect(Object.keys(mockLocalStorage)).toHaveLength(0);
  });

  it('should establish a session via setSession with only an access token', async () => {
    mockRefreshToken.mockResolvedValue(null);
    mockGetMe.mockResolvedValue(mockUser);

    function SessionConsumer() {
      const { user, isLoading, setSession } = useAuth();
      if (isLoading) return <div>Loading</div>;
      return (
        <div>
          <span>{user ? `User: ${user.username}` : 'No user'}</span>
          <button onClick={() => setSession({ accessToken: 'google-token' })}>SetSession</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <SessionConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText('SetSession').click();
    });

    await waitFor(() => {
      expect(screen.getByText('User: testuser')).toBeInTheDocument();
    });
  });

  it('should clear user after logout', async () => {
    mockRefreshToken.mockResolvedValue({
      accessToken: 'token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    mockGetMe.mockResolvedValue(mockUser);
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

    expect(mockLogout).toHaveBeenCalled();
  });
});
