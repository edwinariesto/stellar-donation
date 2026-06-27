import albedo from '@albedo-link/intent';

// Request public key from Albedo
export async function getAlbedoPublicKey() {
  try {
    const response = await albedo.publicKey();
    return response.pubkey;
  } catch (error) {
    console.error('Albedo connection error:', error);
    throw new Error('User declined access or no address returned.');
  }
}

// Sign transaction with Albedo
export async function signAlbedoTransaction(xdrString, networkName) {
  try {
    const response = await albedo.tx({
      xdr: xdrString,
      network: networkName.toLowerCase() // albedo expects 'testnet' or 'public'
    });
    return response.signed_envelope_xdr;
  } catch (error) {
    console.error('Albedo signing error:', error);
    throw error;
  }
}
