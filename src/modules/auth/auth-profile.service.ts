import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { hashPassword, comparePassword } from './utils/password';
import type { UserRepository } from './user.repository';
import type { UserProfile, UpdateProfileInput } from './auth.types';

/**
 * Post-login profile operations (read profile, change username/password). Split
 * out of auth.service so that core auth (register/login/refresh/oauth) and
 * profile management stay focused, each with one clear responsibility.
 */
export interface AuthProfileService {
  getMe(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
}

export function createAuthProfileService(deps: { userRepo: UserRepository }): AuthProfileService {
  const { userRepo } = deps;

  async function getMe(userId: string): Promise<UserProfile> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async function changePassword(args: {
    userId: string;
    currentHash: string | null;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const valid = args.currentHash
      ? await comparePassword(args.currentPassword, args.currentHash)
      : false;
    if (!valid) {
      throw new ValidationError('Current password is incorrect', 'INVALID_PASSWORD');
    }
    await userRepo.updatePassword(args.userId, await hashPassword(args.newPassword));
  }

  async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const newUsername =
      input.username && input.username !== user.username ? input.username : undefined;
    if (newUsername && (await userRepo.findByUsername(newUsername))) {
      throw new ConflictError('Username already taken', 'USERNAME_TAKEN');
    }

    if (input.currentPassword && input.newPassword) {
      await changePassword({
        userId,
        currentHash: user.passwordHash,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      });
    }

    if (newUsername) {
      await userRepo.updateUsername(userId, newUsername);
    }

    return getMe(userId);
  }

  return { getMe, updateProfile };
}
