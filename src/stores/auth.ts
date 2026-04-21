import { create } from "zustand";
import { apiPost, AUTH_STORAGE_KEY, isTokenValid } from "@/lib/api";
import type {
  AdminAccessReturnDto,
  ApiResult,
  UserAuthenticationDto,
} from "@/lib/types";
import type { Permission } from "@/lib/permissions";

function loadAuth(): AdminAccessReturnDto | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminAccessReturnDto;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AdminAccessReturnDto | null;
  isLoggedIn: () => boolean;
  hasPermission: (p: Permission) => boolean;
  login: (
    dto: UserAuthenticationDto,
  ) => Promise<ApiResult<AdminAccessReturnDto>>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadAuth(),

  isLoggedIn: () => {
    const { user } = get();
    return !!user && isTokenValid(user.accessToken);
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    return user.userDTO.role?.permissions?.some((x) => x.name === permission)
      ?? false;
  },

  login: async (dto) => {
    const result = await apiPost<AdminAccessReturnDto>(
      "authentication/login",
      dto,
    );
    if (result.status && result.data) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.data));
      set({ user: result.data });
    }
    return result;
  },

  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    set({ user: null });
  },
}));
