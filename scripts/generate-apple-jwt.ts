#!/usr/bin/env tsx
/**
 * Generate Apple Client Secret JWT for Supabase OAuth configuration
 * 
 * Usage (with file path):
 *   tsx scripts/generate-apple-jwt.ts <path-to-p8-file> <key-id> <team-id> <client-id>
 * 
 * Usage (with key contents - recommended):
 *   tsx scripts/generate-apple-jwt.ts --key <key-id> <team-id> <client-id>
 *   Then paste the .p8 file contents when prompted
 * 
 * Example with file:
 *   tsx scripts/generate-apple-jwt.ts AuthKey_ABC123DEFG.p8 ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu
 * 
 * Example with interactive key input:
 *   tsx scripts/generate-apple-jwt.ts --key ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu
 *   (Then paste your .p8 file contents when prompted)
 * 
 * The generated JWT should be pasted into Supabase Dashboard > Authentication > Providers > Apple > Secret Key
 * 
 * Note: Requires jsonwebtoken package (install with: npm install --save-dev jsonwebtoken @types/jsonwebtoken)
 */

import { readFileSync, existsSync } from 'fs'
import { createPrivateKey } from 'crypto'
import jwt from 'jsonwebtoken'

function generateAppleClientSecret(
  privateKey: string,
  keyId: string,
  teamId: string,
  clientId: string
): string {
  // Normalize the key - remove any extra whitespace
  privateKey = privateKey.trim()
  
  // Validate key format
  if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN EC PRIVATE KEY')) {
    throw new Error('Invalid private key format. Expected PEM format (.p8 file). The key should start with "-----BEGIN PRIVATE KEY-----"')
  }

  // Ensure the key has proper line endings (CRLF or LF)
  // Apple .p8 files are PKCS#8 format which should work with ES256
  let normalizedKey = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // Ensure key ends with newline (some parsers expect this)
  if (!normalizedKey.endsWith('\n')) {
    normalizedKey += '\n'
  }

  // Verify the key is actually an EC key using Node's crypto module
  let cryptoKey: any
  try {
    cryptoKey = createPrivateKey(normalizedKey)
    const keyType = cryptoKey.asymmetricKeyType
    const keyDetails = cryptoKey.asymmetricKeyDetails
    
    console.log('')
    console.log('Key validation:')
    console.log(`  Key type: ${keyType}`)
    if (keyDetails) {
      console.log(`  Key details:`, keyDetails)
    }
    console.log('')
    
    if (keyType !== 'ec') {
      throw new Error(`Expected EC (Elliptic Curve) key, but got ${keyType} key. Make sure you're using the Sign in with Apple key from Apple Developer.`)
    }
    
    // Verify it's P-256 curve (required for ES256)
    if (keyDetails && keyDetails.namedCurve && keyDetails.namedCurve !== 'prime256v1') {
      console.warn(`Warning: Key uses curve ${keyDetails.namedCurve}, but ES256 requires prime256v1 (P-256)`)
    }
  } catch (cryptoError) {
    if (cryptoError instanceof Error) {
      throw new Error(`Failed to parse private key: ${cryptoError.message}. Make sure you copied the complete .p8 file contents.`)
    }
    throw cryptoError
  }

  try {
    // Generate JWT using jsonwebtoken library
    // ES256 = ECDSA using P-256 curve and SHA-256 hash
    // Use the crypto key object if available, otherwise fall back to string
    const token = jwt.sign(
      {},
      cryptoKey || normalizedKey,
      {
        algorithm: 'ES256',
        expiresIn: '180d', // 180 days (6 months)
        audience: 'https://appleid.apple.com',
        issuer: teamId,
        subject: clientId,
        keyid: keyId,
      }
    )

    return token
  } catch (error) {
    // Provide more helpful error message with debugging info
    if (error instanceof Error) {
      if (error.message.includes('asymmetric key') || error.message.includes('EC')) {
        console.error('')
        console.error('Key validation failed. Common issues:')
        console.error('  1. Make sure you copied the ENTIRE .p8 file contents')
        console.error('  2. The key should include both BEGIN and END lines')
        console.error('  3. There should be no extra characters before BEGIN or after END')
        console.error('  4. The key should be from Apple Developer > Keys (not a certificate)')
        console.error('')
        console.error('Expected format:')
        console.error('  -----BEGIN PRIVATE KEY-----')
        console.error('  [base64 encoded key content - multiple lines]')
        console.error('  -----END PRIVATE KEY-----')
        console.error('')
        throw new Error(
          'The private key format is not recognized as an EC (Elliptic Curve) key. ' +
          'Please verify you copied the complete .p8 file contents from Apple Developer. ' +
          `Error details: ${error.message}`
        )
      }
      throw error
    }
    throw error
  }
}

// Helper function to read key from stdin
async function readKeyFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('')
    console.log('Please paste your .p8 private key contents below.')
    console.log('Include the BEGIN and END lines. Press Enter, then Ctrl+D (or Ctrl+Z on Windows) when done:')
    console.log('')
    
    const chunks: Buffer[] = []
    
    process.stdin.setEncoding('utf8')
    
    process.stdin.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk, 'utf8'))
    })
    
    process.stdin.on('end', () => {
      const key = Buffer.concat(chunks).toString('utf8').trim()
      if (!key) {
        reject(new Error('No key content received. Please paste your .p8 file contents.'))
        return
      }
      resolve(key)
    })
    
    process.stdin.on('error', (error) => {
      reject(error)
    })
  })
}

// Helper function to detect if argument is a file path
function isFilePath(arg: string): boolean {
  // Check if it looks like a file path
  return existsSync(arg) || arg.includes('/') || arg.includes('\\') || arg.endsWith('.p8')
}

// Main execution
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2)

    let privateKey: string
    let keyId: string
    let teamId: string
    let clientId: string

    // Check if using --key flag for interactive key input
    if (args[0] === '--key' && args.length === 4) {
      // Format: --key <key-id> <team-id> <client-id>
      // Read key from stdin
      keyId = args[1]
      teamId = args[2]
      clientId = args[3]
      
      privateKey = await readKeyFromStdin()
    } else if (args.length === 4) {
      // Format: <p8-file-path-or-contents> <key-id> <team-id> <client-id>
      const firstArg = args[0]
      keyId = args[1]
      teamId = args[2]
      clientId = args[3]
      
      // Auto-detect: if it looks like a file path, read it; otherwise treat as key contents
      if (isFilePath(firstArg)) {
        // Read the private key file
        try {
          privateKey = readFileSync(firstArg, 'utf8')
        } catch (error) {
          console.error(`Error: Failed to read private key file: ${error instanceof Error ? error.message : String(error)}`)
          process.exit(1)
        }
      } else {
        // Treat as key contents (pasted directly)
        privateKey = firstArg
      }
    } else {
      console.error('Usage (with file path):')
      console.error('  tsx scripts/generate-apple-jwt.ts <p8-file-path> <key-id> <team-id> <client-id>')
      console.error('')
      console.error('Usage (with interactive key input - RECOMMENDED):')
      console.error('  tsx scripts/generate-apple-jwt.ts --key <key-id> <team-id> <client-id>')
      console.error('  (Then paste your .p8 file contents when prompted)')
      console.error('')
      console.error('Examples:')
      console.error('  tsx scripts/generate-apple-jwt.ts AuthKey_ABC123DEFG.p8 ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu')
      console.error('  tsx scripts/generate-apple-jwt.ts --key ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu')
      console.error('')
      console.error('Arguments:')
      console.error('  p8-file-path OR --key: Path to your Apple .p8 private key file, or use --key for interactive input')
      console.error('  key-id: Your Apple Key ID (10 characters, found in Apple Developer > Keys)')
      console.error('  team-id: Your Apple Team ID (found next to your name in Apple Developer)')
      console.error('  client-id: Your Apple Service ID (e.g., app.uconstruct.cfmeu)')
      console.error('')
      console.error('Tip: Using --key is recommended as it handles multi-line key content better.')
      process.exit(1)
    }

    try {
      const jwtToken = generateAppleClientSecret(privateKey, keyId, teamId, clientId)
      
      console.log('')
      console.log('='.repeat(80))
      console.log('Apple Client Secret JWT Generated Successfully')
      console.log('='.repeat(80))
      console.log('')
      console.log('Copy the JWT below and paste it into Supabase Dashboard:')
      console.log('  Authentication > Providers > Apple > Secret Key')
      console.log('')
      console.log('-'.repeat(80))
      console.log(jwtToken)
      console.log('-'.repeat(80))
      console.log('')
      console.log('Note: This JWT expires in 6 months. You will need to regenerate it.')
      console.log('')
    } catch (error) {
      console.error('Error generating JWT:', error instanceof Error ? error.message : String(error))
      if (error instanceof Error && error.message.includes('Invalid private key format')) {
        console.error('')
        console.error('Make sure you\'re providing the complete .p8 file contents including:')
        console.error('  -----BEGIN PRIVATE KEY-----')
        console.error('  [key content]')
        console.error('  -----END PRIVATE KEY-----')
      }
      process.exit(1)
    }
  })()
}

export { generateAppleClientSecret }
