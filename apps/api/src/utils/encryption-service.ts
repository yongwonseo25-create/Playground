import crypto from 'crypto';

/**
 * [Auditor Fix] 엔터프라이즈급 OAuth 토큰 암호화 서비스 (AES-256-GCM)
 */
export class EncryptionService {
  private static ALGORITHM = 'aes-256-gcm';
  private static KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'voxera-default-secret', 'salt', 32);

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.KEY, iv) as any;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  static decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.KEY, iv) as any;
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
