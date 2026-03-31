import { createHmac, randomBytes } from "node:crypto";

import type { HttpHeaders } from "./http";

export interface Clock {
  now(): Date;
}

export interface SaltGenerator {
  next(): string;
}

export interface SolapiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface SolapiAuthHeaders extends HttpHeaders {
  Authorization: string;
  "Content-Type": "application/json";
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class HexSaltGenerator implements SaltGenerator {
  next(): string {
    return randomBytes(16).toString("hex");
  }
}

export class SolapiAuthSigner {
  constructor(
    private readonly credentials: SolapiCredentials,
    private readonly clock: Clock = new SystemClock(),
    private readonly saltGenerator: SaltGenerator = new HexSaltGenerator(),
  ) {}

  sign(): SolapiAuthHeaders {
    const date = this.clock.now().toISOString();
    const salt = this.saltGenerator.next();

    if (!/^[0-9a-f]{32}$/i.test(salt)) {
      throw new Error("SOLAPI_AUTH_INVALID_SALT");
    }

    const signature = createHmac("sha256", this.credentials.apiSecret)
      .update(date + salt, "utf8")
      .digest("hex");

    return {
      Authorization: [
        "HMAC-SHA256",
        `apiKey=${this.credentials.apiKey},`,
        `date=${date},`,
        `salt=${salt},`,
        `signature=${signature}`,
      ].join(" "),
      "Content-Type": "application/json",
    };
  }
}
