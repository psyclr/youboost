import {
  findByEmail,
  findByUsername,
  findById,
  createUser,
  setEmailVerified,
  updatePassword,
} from '../user.repository';

const mockUser = {
  id: '123',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  }),
}));

describe('User Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockFindUnique.mockResolvedValue(mockUser);
      const result = await findByEmail('test@test.com');
      expect(result).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await findByEmail('nope@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      mockFindUnique.mockResolvedValue(mockUser);
      const result = await findByUsername('testuser');
      expect(result).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      mockFindUnique.mockResolvedValue(mockUser);
      const result = await findById('123');
      expect(result).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '123' } });
    });
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      mockCreate.mockResolvedValue(mockUser);
      const data = { email: 'test@test.com', username: 'testuser', passwordHash: 'hash' };
      const result = await createUser(data);
      expect(result).toEqual(mockUser);
      expect(mockCreate).toHaveBeenCalledWith({ data });
    });
  });

  describe('setEmailVerified', () => {
    it('should update emailVerified to true', async () => {
      mockUpdate.mockResolvedValue(mockUser);
      await setEmailVerified('123');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { emailVerified: true },
      });
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      mockUpdate.mockResolvedValue(mockUser);
      await updatePassword('123', 'newhash');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { passwordHash: 'newhash' },
      });
    });
  });
});
