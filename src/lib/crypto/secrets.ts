import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY_LENGTH = 32
const IV_LENGTH = 12 // GCM recommended length

type SupportedEncoding = 'base64' | 'hex' | 'utf8'

function decodeKey(secret: string): Buffer {
  const encodings: SupportedEncoding[] = ['base64', 'hex', 'utf8']
  for (const encoding of encodings) {
    try {
      const buffer = Buffer.from(secret, encoding)
      if (buffer.length === KEY_LENGTH) {
        return buffer
      }
    } catch {
      // ignore invalid decode attempt
    }
  }
  throw new Error('Encryption key must be 32 bytes (provide as base64, hex, or utf8 string).')
}

function getKey(envVar: string): Buffer {
  const secret = process.env[envVar]
  if (!secret) {
    throw new Error(`${envVar} environment variable is required for credential encryption`)
  }
  return decodeKey(secret)
}

export function encryptWithEnvKey(envVar: string, plaintext: string): string {
  const key = getKey(envVar)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${ciphertext.toString('base64')}.${authTag.toString('base64')}`
}

export function decryptWithEnvKey(envVar: string, payload: string): string {
  const key = getKey(envVar)
  const parts = payload.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format')
  }
  const [ivB64, dataB64, tagB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const ciphertext = Buffer.from(dataB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
