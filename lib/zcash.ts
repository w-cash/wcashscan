/**
 * Detect a Wcash address family from its prefix for routing/search hints only.
 * Authoritative checksum and receiver validation happens in the API and the
 * Wcash decoder; callers must not treat this as validation.
 */
export function detectAddressType(address: string): 'shielded' | 'transparent' | 'unified' | 'invalid' {
  if (address.startsWith('wutest') || address.startsWith('wuregtest') || address.startsWith('wu1')) {
    return 'unified';
  }
  if (address.startsWith('wtextest') || address.startsWith('wtexregtest') || address.startsWith('wtex1')) {
    return 'transparent';
  }
  // Wcash transparent Base58Check namespaces:
  // W1/W3 mainnet, WT/WU testnet, WR/WS regtest.
  if (/^W[13TURS][1-9A-HJ-NP-Za-km-z]+$/.test(address)) {
    return 'transparent';
  }
  return 'invalid';
}
