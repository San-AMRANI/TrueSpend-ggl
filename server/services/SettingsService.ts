import { userRepository } from '../repositories/UserRepository.js';

export interface UpdateSettingsDTO {
  payday?: number;
  emergencyBuffer?: number;
}

export class SettingsService {
  async getSettings(dbUser: any) {
    return {
      payday: dbUser.payday || 25,
      emergencyBuffer: dbUser.emergencyBuffer || 0,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDTO) {
    const updateData: { payday?: number; emergencyBuffer?: string } = {};

    if (dto.payday !== undefined) {
      if (dto.payday >= 1 && dto.payday <= 31) {
        updateData.payday = dto.payday;
      } else {
        throw new Error('Invalid payday');
      }
    }

    if (dto.emergencyBuffer !== undefined) {
      if (dto.emergencyBuffer >= 0) {
        updateData.emergencyBuffer = String(dto.emergencyBuffer);
      } else {
        throw new Error('Invalid emergency buffer');
      }
    }

    if (Object.keys(updateData).length > 0) {
      await userRepository.updateSettings(userId, updateData);
    }

    return { success: true, ...updateData };
  }
}

export const settingsService = new SettingsService();
