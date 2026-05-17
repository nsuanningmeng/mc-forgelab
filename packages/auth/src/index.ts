/**
 * @mc-forgelab/auth — 阶段 6/7 实施
 *
 * - 默认本地模式不开登录
 * - 检测公网 / BASE_URL 为 https 域名时提示开启
 * - 密码哈希 (argon2 或 scrypt)，绝不明文写日志
 * - 下载接口校验 Principal
 */

export interface Principal {
  readonly id: string;
  readonly username: string;
  readonly role: "admin" | "viewer";
}

export interface AuthProvider {
  isEnabled(): boolean;
  authenticate(username: string, password: string): Promise<Principal | null>;
  verifySession(token: string): Promise<Principal | null>;
  createSession(principal: Principal): Promise<{ token: string; expiresAt: string }>;
  revokeSession(token: string): Promise<void>;
}

export function createDisabledAuthProvider(): AuthProvider {
  return {
    isEnabled: () => false,
    async authenticate() {
      throw new Error("auth: not implemented (stage 6/7)");
    },
    async verifySession() {
      return null;
    },
    async createSession() {
      throw new Error("auth: not implemented (stage 6/7)");
    },
    async revokeSession() {
      // no-op
    }
  };
}
