// License: CC0 (no rights reserved).
// Based on Rocicorp's fractional indexing algorithm: https://github.com/rocicorp/fractional-indexing

export const BASE_62_DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // 0-9 + A-Z + a-z

export const BASE_52_DIGITS = BASE_62_DIGITS.slice(10); // A-Z + a-z

const digitIndexCache = new Map<string, Uint8Array>();

function getDigitIndex(digits: string): Uint8Array {
  let m = digitIndexCache.get(digits);
  if (m === undefined) {
    m = new Uint8Array(256);
    for (let i = 0; i < digits.length; i++) {
      m[digits.charCodeAt(i)] = i;
    }
    digitIndexCache.set(digits, m);
  }
  return m;
}

function midpoint(
  a: string,
  b: string | null | undefined,
  digits: string,
  lookup: Uint8Array
): string {
  const zero = digits[0];
  if (b != null && a >= b) {
    throw new Error(a + " >= " + b);
  }
  if (a.slice(-1) === zero || (b && b.slice(-1) === zero)) {
    throw new Error("trailing zero");
  }
  if (b) {
    let n = 0;
    while ((a[n] || zero) === b[n]) {
      n++;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n), digits, lookup);
    }
  }
  const digitA = a ? lookup[a.charCodeAt(0)] : 0;
  const digitB = b != null ? lookup[b.charCodeAt(0)] : digits.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return digits[midDigit];
  } else {
    if (b && b.length > 1) {
      return b.slice(0, 1);
    } else {
      return digits[digitA] + midpoint(a.slice(1), null, digits, lookup);
    }
  }
}

function validateInteger(
  int: string,
  intDigits: string,
  intLookup: Uint8Array
): void {
  if (int.length !== getIntegerLength(int[0], intDigits, intLookup)) {
    throw new Error("invalid integer part of order key: " + int);
  }
}

function getIntegerLength(
  head: string,
  intDigits: string,
  intLookup: Uint8Array
): number {
  const i = intLookup[head.charCodeAt(0)];
  if (intDigits[i] === head) {
    const half = intDigits.length / 2;
    return i < half ? half - i + 1 : i - half + 2;
  }
  throw new Error("invalid order key head: " + head);
}

function getIntegerPart(
  key: string,
  intDigits: string,
  intLookup: Uint8Array
): string {
  const integerPartLength = getIntegerLength(key[0], intDigits, intLookup);
  if (integerPartLength > key.length) {
    throw new Error("invalid order key: " + key);
  }
  return key.slice(0, integerPartLength);
}

function validateOrderKey(
  key: string,
  digits: string,
  intDigits: string,
  intLookup: Uint8Array
): void {
  if (isSmallestInteger(key, digits, intDigits)) {
    throw new Error("invalid order key: " + key);
  }
  const i = getIntegerPart(key, intDigits, intLookup);
  const f = key.slice(i.length);
  if (f.slice(-1) === digits[0]) {
    throw new Error("invalid order key: " + key);
  }
}

function incrementInteger(
  x: string,
  digits: string,
  lookup: Uint8Array,
  intDigits: string,
  intLookup: Uint8Array
): string | null {
  validateInteger(x, intDigits, intLookup);
  const head = x[0];
  const zero = digits[0];
  let trailing = "";
  for (let i = x.length - 1; i >= 1; i--) {
    const d = lookup[x.charCodeAt(i)] + 1;
    if (d === digits.length) {
      trailing = zero + trailing;
    } else {
      return head + x.slice(1, i) + digits[d] + trailing;
    }
  }
  const headIndex = intLookup[head.charCodeAt(0)];
  if (headIndex === intDigits.length - 1) {
    return null;
  }
  const h = intDigits[headIndex + 1];
  const lengthDelta =
    getIntegerLength(h, intDigits, intLookup) -
    getIntegerLength(head, intDigits, intLookup);
  return (
    h +
    (lengthDelta > 0
      ? trailing + zero
      : lengthDelta < 0
      ? trailing.slice(1)
      : trailing)
  );
}

function decrementInteger(
  x: string,
  digits: string,
  lookup: Uint8Array,
  intDigits: string,
  intLookup: Uint8Array
): string | null {
  validateInteger(x, intDigits, intLookup);
  const head = x[0];
  const last = digits[digits.length - 1];
  let trailing = "";
  for (let i = x.length - 1; i >= 1; i--) {
    const d = lookup[x.charCodeAt(i)] - 1;
    if (d === -1) {
      trailing = last + trailing;
    } else {
      return head + x.slice(1, i) + digits[d] + trailing;
    }
  }
  const headIndex = intLookup[head.charCodeAt(0)];
  if (headIndex === 0) {
    return null;
  }
  const h = intDigits[headIndex - 1];
  const lengthDelta =
    getIntegerLength(h, intDigits, intLookup) -
    getIntegerLength(head, intDigits, intLookup);
  return (
    h +
    (lengthDelta > 0
      ? trailing + last
      : lengthDelta < 0
      ? trailing.slice(1)
      : trailing)
  );
}

const repeatedKeysCache = new Map<string, Map<number, string>>();

function isSmallestInteger(
  key: string,
  digits: string,
  intDigits: string
): boolean {
  let byDigit = repeatedKeysCache.get(intDigits);
  if (byDigit === undefined) {
    byDigit = new Map();
    repeatedKeysCache.set(intDigits, byDigit);
  }
  const zeroCode = digits.charCodeAt(0);
  let cached = byDigit.get(zeroCode);
  if (cached === undefined) {
    cached = intDigits[0] + digits[0].repeat(intDigits.length / 2);
    byDigit.set(zeroCode, cached);
  }
  return key === cached;
}

function isStrictlyAscending(s: string): boolean {
  for (let i = 1; i < s.length; i++) {
    if (s.charCodeAt(i - 1) >= s.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function isSingleByte(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) {
      return false;
    }
  }
  return true;
}

const validatedDigits = new Set<string>();

function validateDigits(digits: string): void {
  if (validatedDigits.has(digits)) {
    return;
  }
  if (digits.length < 2 || !isStrictlyAscending(digits)) {
    throw new Error(
      "digits must be at least 2 characters in strictly ascending character code order: " +
        digits
    );
  }
  if (!isSingleByte(digits)) {
    throw new Error("digits must be single-byte (char code 0-255): " + digits);
  }
  validatedDigits.add(digits);
}

const validatedIntDigits = new Set<string>();

function validateIntDigits(intDigits: string): void {
  if (validatedIntDigits.has(intDigits)) {
    return;
  }
  if (
    intDigits.length < 2 ||
    intDigits.length % 2 !== 0 ||
    !isStrictlyAscending(intDigits)
  ) {
    throw new Error(
      "intDigits must be an even number of at least 2 characters in strictly ascending character code order: " +
        intDigits
    );
  }
  if (!isSingleByte(intDigits)) {
    throw new Error(
      "intDigits must be single-byte (char code 0-255): " + intDigits
    );
  }
  validatedIntDigits.add(intDigits);
}

export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  digits?: string,
  intDigits?: string
): string {
  let resolvedIntDigits: string;
  if (intDigits !== undefined) {
    validateIntDigits(intDigits);
    resolvedIntDigits = intDigits;
  } else {
    resolvedIntDigits = digits ?? BASE_52_DIGITS;
  }

  let resolvedDigits: string;
  if (digits !== undefined) {
    validateDigits(digits);
    resolvedDigits = digits;
  } else {
    resolvedDigits = BASE_62_DIGITS;
  }

  const lookup = getDigitIndex(resolvedDigits);
  const intLookup = getDigitIndex(resolvedIntDigits);
  if (a != null) {
    validateOrderKey(a, resolvedDigits, resolvedIntDigits, intLookup);
  }
  if (b != null) {
    validateOrderKey(b, resolvedDigits, resolvedIntDigits, intLookup);
  }
  if (a != null && b != null) {
    if (a > b) {
      const temp = a;
      a = b;
      b = temp;
    }
  }

  if (a == null) {
    if (b == null) {
      const head = resolvedIntDigits[resolvedIntDigits.length / 2];
      return head + resolvedDigits[0];
    }

    const ib = getIntegerPart(b, resolvedIntDigits, intLookup);
    const fb = b.slice(ib.length);
    if (isSmallestInteger(ib, resolvedDigits, resolvedIntDigits)) {
      return ib + midpoint("", fb, resolvedDigits, lookup);
    }
    if (ib < b) {
      return ib;
    }
    const res = decrementInteger(
      ib,
      resolvedDigits,
      lookup,
      resolvedIntDigits,
      intLookup
    );
    if (res == null) {
      throw new Error("cannot decrement any more");
    }
    return res;
  }

  if (b == null) {
    const ia = getIntegerPart(a, resolvedIntDigits, intLookup);
    const fa = a.slice(ia.length);
    const i = incrementInteger(
      ia,
      resolvedDigits,
      lookup,
      resolvedIntDigits,
      intLookup
    );
    return i == null ? ia + midpoint(fa, null, resolvedDigits, lookup) : i;
  }

  const ia = getIntegerPart(a, resolvedIntDigits, intLookup);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b, resolvedIntDigits, intLookup);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb, resolvedDigits, lookup);
  }
  const i = incrementInteger(
    ia,
    resolvedDigits,
    lookup,
    resolvedIntDigits,
    intLookup
  );
  if (i == null) {
    throw new Error("cannot increment any more");
  }
  if (i < b) {
    return i;
  }
  return ia + midpoint(fa, null, resolvedDigits, lookup);
}

export function generateNKeysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  n: number,
  digits?: string,
  intDigits?: string
): string[] {
  let resolvedIntDigits: string;
  if (intDigits !== undefined) {
    validateIntDigits(intDigits);
    resolvedIntDigits = intDigits;
  } else {
    resolvedIntDigits = digits ?? BASE_52_DIGITS;
  }

  let resolvedDigits: string;
  if (digits !== undefined) {
    validateDigits(digits);
    resolvedDigits = digits;
  } else {
    resolvedDigits = BASE_62_DIGITS;
  }

  if (n === 0) {
    return [];
  }
  if (n === 1) {
    return [generateKeyBetween(a, b, resolvedDigits, resolvedIntDigits)];
  }
  if (b == null) {
    let c = generateKeyBetween(a, b, resolvedDigits, resolvedIntDigits);
    const result = [c];
    for (let i = 0; i < n - 1; i++) {
      c = generateKeyBetween(c, b, resolvedDigits, resolvedIntDigits);
      result.push(c);
    }
    return result;
  }
  if (a == null) {
    let c = generateKeyBetween(a, b, resolvedDigits, resolvedIntDigits);
    const result = [c];
    for (let i = 0; i < n - 1; i++) {
      c = generateKeyBetween(a, c, resolvedDigits, resolvedIntDigits);
      result.push(c);
    }
    result.reverse();
    return result;
  }
  const mid = Math.floor(n / 2);
  const c = generateKeyBetween(a, b, resolvedDigits, resolvedIntDigits);
  return [
    ...generateNKeysBetween(a, c, mid, resolvedDigits, resolvedIntDigits),
    c,
    ...generateNKeysBetween(c, b, n - mid - 1, resolvedDigits, resolvedIntDigits),
  ];
}
