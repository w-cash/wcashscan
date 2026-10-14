const { bech32, bech32m } = require('bech32');
const { blake2b } = require('@noble/hashes/blake2.js');
const crypto = require('crypto');

const MAX_BECH32_LENGTH = 1_000;
const MAX_F4JUMBLE_BYTES = 700;
const F4JUMBLE_MIN_BYTES = 48;
const ZIP316_PADDING_BYTES = 16;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function xorInto(target, source) {
  for (let index = 0; index < Math.min(target.length, source.length); index += 1) {
    target[index] ^= source[index];
  }
}

function hPersonalization(round) {
  return Uint8Array.from([85, 65, 95, 70, 52, 74, 117, 109, 98, 108, 101, 95, 72, round, 0, 0]);
}

function gPersonalization(round, block) {
  return Uint8Array.from([
    85, 65, 95, 70, 52, 74, 117, 109, 98, 108, 101, 95, 71,
    round, block & 0xff, (block >>> 8) & 0xff,
  ]);
}

function applyH(left, right, round) {
  xorInto(left, blake2b(right, { dkLen: left.length, personalization: hPersonalization(round) }));
}

function applyG(left, right, round) {
  for (let block = 0; block * 64 < right.length; block += 1) {
    const hash = blake2b(left, { dkLen: 64, personalization: gPersonalization(round, block) });
    xorInto(right.subarray(block * 64), hash);
  }
}

/** Invert ZIP-316's F4Jumble permutation used by W.cash Unified Addresses. */
function f4JumbleInverse(message) {
  if (message.length < F4JUMBLE_MIN_BYTES || message.length > MAX_F4JUMBLE_BYTES) return null;
  const leftLength = Math.min(64, Math.floor(message.length / 2));
  const left = message.slice(0, leftLength);
  const right = message.slice(leftLength);
  applyH(left, right, 1);
  applyG(left, right, 1);
  applyH(left, right, 0);
  applyG(left, right, 0);
  return Uint8Array.from([...left, ...right]);
}

function readCompactSize(bytes, offset) {
  if (offset >= bytes.length) return null;
  const marker = bytes[offset];
  if (marker < 253) return { value: marker, next: offset + 1 };
  if (marker === 253) {
    if (offset + 3 > bytes.length) return null;
    const value = bytes[offset + 1] | (bytes[offset + 2] << 8);
    return value < 253 ? null : { value, next: offset + 3 };
  }
  if (marker === 254) {
    if (offset + 5 > bytes.length) return null;
    const value = bytes[offset + 1]
      | (bytes[offset + 2] << 8)
      | (bytes[offset + 3] << 16)
      | (bytes[offset + 4] * 0x1000000);
    return value <= 0xffff ? null : { value, next: offset + 5 };
  }
  return null;
}

function hasValidWcashUnifiedPayload(bytes, hrp) {
  const unjumbled = f4JumbleInverse(Uint8Array.from(bytes));
  if (!unjumbled || unjumbled.length < ZIP316_PADDING_BYTES + 2) return false;
  const rawEnd = unjumbled.length - ZIP316_PADDING_BYTES;
  const raw = unjumbled.subarray(0, rawEnd);
  const padding = unjumbled.subarray(rawEnd);
  const expectedPadding = new Uint8Array(ZIP316_PADDING_BYTES);
  expectedPadding.set(Buffer.from(hrp, 'ascii'));
  if (!padding.every((byte, index) => byte === expectedPadding[index])) return false;

  let offset = 0;
  let previousTypecode = -1;
  let hasIronwoodReceiver = false;
  while (offset < raw.length) {
    const typecode = readCompactSize(raw, offset);
    if (!typecode || typecode.value <= previousTypecode) return false;
    offset = typecode.next;
    const length = readCompactSize(raw, offset);
    if (!length || offset + (length.next - offset) + length.value > raw.length) return false;
    offset = length.next;
    const receiver = raw.subarray(offset, offset + length.value);
    offset += length.value;
    previousTypecode = typecode.value;

    // W.cash's Ironwood receiver occupies ZIP-316's Orchard typecode. The
    // transparent receiver typecodes are permitted, while Sapling and unknown
    // receiver types are intentionally rejected by Wolf.
    if (typecode.value === 0 || typecode.value === 1) {
      if (length.value !== 20) return false;
    } else if (typecode.value === 2) {
      return false;
    } else if (typecode.value === 3) {
      if (length.value !== 43) return false;
      hasIronwoodReceiver = true;
    } else {
      return false;
    }
    if (receiver.length === 0) return false;
  }
  return offset === raw.length && hasIronwoodReceiver;
}

/** Validate a W.cash Unified Address, including F4Jumble and receivers. */
function isValidUnifiedAddress(address) {
  if (typeof address !== 'string') return false;
  const expectedPrefix = address.startsWith('wutest1') ? 'wutest'
    : address.startsWith('wuregtest1') ? 'wuregtest'
      : address.startsWith('wu1') ? 'wu'
      : null;
  if (expectedPrefix === null) return false;
  try {
    const decoded = bech32m.decode(address, MAX_BECH32_LENGTH);
    if (decoded.prefix !== expectedPrefix) return false;
    const bytes = bech32m.fromWords(decoded.words);
    return hasValidWcashUnifiedPayload(bytes, expectedPrefix);
  } catch {
    return false;
  }
}

function isValidWcashTexAddress(address) {
  if (typeof address !== 'string') return false;
  const expectedPrefix = address.startsWith('wtextest1') ? 'wtextest'
    : address.startsWith('wtexregtest1') ? 'wtexregtest'
      : address.startsWith('wtex1') ? 'wtex'
        : null;
  if (expectedPrefix === null) return false;
  try {
    const decoded = bech32m.decode(address, MAX_BECH32_LENGTH);
    // A W.cash TEX receiver is a 20-byte transparent payload encoded as
    // exactly 32 five-bit words. Checking only that words exist would accept
    // arbitrary bech32m data with a W.cash-looking prefix.
    return decoded.prefix === expectedPrefix && decoded.words.length === 32;
  } catch {
    return false;
  }
}

function decodeBase58(value) {
  let number = 0n;
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) return null;
    number = number * 58n + BigInt(digit);
  }

  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = number === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === '1') leadingZeroes += 1;
  return Buffer.concat([Buffer.alloc(leadingZeroes), body]);
}

const BASE58_VERSIONS = new Map([
  ['1055', 22], // Wcash mainnet P2PKH (W1...)
  ['105a', 22], // Wcash mainnet P2SH (W3...)
  ['1095', 22], // Wcash testnet P2PKH (WT...)
  ['1098', 22], // Wcash testnet P2SH (WU...)
  ['1090', 22], // Wcash regtest P2PKH (WR...)
  ['1093', 22], // Wcash regtest P2SH (WS...)
]);

/** Validate a Wcash transparent Base58Check address. */
function isValidBase58CheckAddress(address) {
  if (typeof address !== 'string' || address.length < 20 || address.length > 200) return false;
  const decoded = decodeBase58(address);
  if (!decoded || decoded.length < 7) return false;
  const payload = decoded.subarray(0, -4);
  const checksum = decoded.subarray(-4);
  const expected = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4);
  const expectedPayloadLength = BASE58_VERSIONS.get(payload.subarray(0, 2).toString('hex'));
  return expectedPayloadLength === payload.length
    && crypto.timingSafeEqual(checksum, expected);
}

module.exports = { isValidUnifiedAddress, isValidWcashTexAddress, isValidBase58CheckAddress };
