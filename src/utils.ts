import type { SmartBuffer } from './smart-arraybuffer.js';

/**
 * Error strings
 */
const ERRORS = {
  INVALID_ENCODING: 'Invalid encoding provided. Please specify a valid encoding the internal Node.js Buffer supports.',
  INVALID_SMARTBUFFER_SIZE: 'Invalid size provided. Size must be a valid integer greater than zero.',
  INVALID_SMARTBUFFER_BUFFER: 'Invalid Buffer provided in SmartBufferOptions.',
  INVALID_SMARTBUFFER_OBJECT: 'Invalid SmartBufferOptions object supplied to SmartBuffer constructor or factory methods.',
  INVALID_OFFSET: 'An invalid offset value was provided.',
  INVALID_OFFSET_NON_NUMBER: 'An invalid offset value was provided. A numeric value is required.',
  INVALID_LENGTH: 'An invalid length value was provided.',
  INVALID_LENGTH_NON_NUMBER: 'An invalid length value was provived. A numeric value is required.',
  INVALID_TARGET_OFFSET: 'Target offset is beyond the bounds of the internal SmartBuffer data.',
  INVALID_TARGET_LENGTH: 'Specified length value moves cursor beyong the bounds of the internal SmartBuffer data.',
  INVALID_READ_BEYOND_BOUNDS: 'Attempted to read beyond the bounds of the managed data.',
  INVALID_WRITE_BEYOND_BOUNDS: 'Attempted to write beyond the bounds of the managed data.'
};

/**
 * Checks if a given encoding is a valid Buffer encoding. (Throws an exception if check fails)
 *
 * @param { String } encoding The encoding string to check.
 */
function checkEncoding(encoding: BufferEncoding) {
  if (!Buffer.isEncoding(encoding)) {
    throw new Error(ERRORS.INVALID_ENCODING);
  }
}

/**
 * Checks if a given number is a finite integer. (Throws an exception if check fails)
 *
 * @param { Number } value The number value to check.
 */
function isFiniteInteger(value: number): boolean {
  return typeof value === 'number' && isFinite(value) && isInteger(value);
}

/**
 * Checks if an offset/length value is valid. (Throws an exception if check fails)
 *
 * @param value The value to check.
 * @param offset True if checking an offset, false if checking a length.
 */
function checkOffsetOrLengthValue(value: any, offset: boolean) {
  if (typeof value === 'number') {
    // Check for non finite/non integers
    if (!isFiniteInteger(value) || value < 0) {
      throw new Error(offset ? ERRORS.INVALID_OFFSET : ERRORS.INVALID_LENGTH);
    }
  } else {
    throw new Error(offset ? ERRORS.INVALID_OFFSET_NON_NUMBER : ERRORS.INVALID_LENGTH_NON_NUMBER);
  }
}

/**
 * Checks if a length value is valid. (Throws an exception if check fails)
 *
 * @param { Number } length The value to check.
 */
function checkLengthValue(length: any) {
  checkOffsetOrLengthValue(length, false);
}

/**
 * Checks if a offset value is valid. (Throws an exception if check fails)
 *
 * @param { Number } offset The value to check.
 */
function checkOffsetValue(offset: any) {
  checkOffsetOrLengthValue(offset, true);
}

/**
 * Checks if a target offset value is out of bounds. (Throws an exception if check fails)
 *
 * @param { Number } offset The offset value to check.
 * @param { SmartBuffer } buff The SmartBuffer instance to check against.
 */
function checkTargetOffset(offset: number, buff: SmartBuffer) {
  if (offset < 0 || offset > buff.length) {
    throw new Error(ERRORS.INVALID_TARGET_OFFSET);
  }
}

// Reference: https://phuoc.ng/collection/this-vs-that/concat-vs-push/
const MAX_BLOCK_SIZE = 65_535;

/**
 * Converts a uint8Array into a base64 string.
 */
function uint8ArrayToBase64(array: Uint8Array): string {

  let base64;
  if (array.length < MAX_BLOCK_SIZE) {
  // Required as `btoa` and `atob` don't properly support Unicode: https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
    base64 = globalThis.btoa(String.fromCodePoint.apply(this, array));
  } else {
    base64 = '';
    for (const value of array) {
      base64 += String.fromCodePoint(value);
    }
    base64 = globalThis.btoa(base64);
  }
  return base64;
}

function uint8ArrayToBinary(array: Uint8Array): string {
  let str = '';
  for (let char of array) {
    str += String.fromCharCode(char % 256)
  }
  return str;
}

function uint8ArrayToHex(array: Uint8Array): string {
  let str = '';
  for (let byte of array) {
    str += byte.toString(16).padStart(2, '0');
  }
  return str;
}

/**
 * @param { Uint8Array } buffer The uint8array to stringify
 * @param { BufferEncoding } encoding The encoding to use when stringifying
 * @return { string }
 */
type TextDecoderCache = {
  [key: string] : TextDecoder;
};
const cachedDecoders : TextDecoderCache = {};
function toString(buffer: Uint8Array, encoding : BufferEncoding):string {
  
  // We support base64, binary and hex ourselves.
  if (encoding === 'base64') {
    return uint8ArrayToBase64(buffer);
  } else if (encoding === 'binary') {
    return uint8ArrayToBinary(buffer);
  } else if (encoding === 'hex') {
    return uint8ArrayToHex(buffer);
  }

  // Note: for now we only support utf-8 encoding. We'll change that though.
  // const decoder = new TextDecoder();
  // return decoder.decode(buffer);
  const decoder = cachedDecoders[encoding] ??= new TextDecoder(encoding);
  return decoder.decode(buffer);

}

function base64ToUint8Array(str: string): Uint8Array {
  return Uint8Array.from(globalThis.atob(str), x => x.codePointAt(0));
}

function hexToUint8Array(str: string): Uint8Array {
  let arr = new Uint8Array(Math.floor(str.length / 2));
  for (let i = 0; i < arr.length; i++) {
    let start = 2*i;
    let end = start+2;
    arr[i] = parseInt(str.slice(start, end), 16);
  }
  return arr;
}

function binaryToUint8Array(str: string): Uint8Array {
  let arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    arr[i] = code;
  }
  return arr;
}

/**
 * @param { string } text The string to convert
 * @param { BufferEncoding } encoding The encoding to use when stringifying.
 */
function stringToUint8Array(text: string, encoding: BufferEncoding): Uint8Array {
  if (encoding === 'base64') {
    return base64ToUint8Array(text);
  } else if (encoding === 'hex') {
    return hexToUint8Array(text);
  } else if (encoding === 'binary') {
    return binaryToUint8Array(text);
  }

  // Any format other than utf8 (or utf-8) is not supported.
  if (encoding !== 'utf8' && encoding !== 'utf-8' && encoding !== 'ascii') {
    throw new Error(`${encoding} encoding is not supported!`);
  }

  return new TextEncoder().encode(text);
}

/**
 * Determines whether a given number is a integer.
 * @param value The number to check.
 */
function isInteger(value: number) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

interface Buffer {
  readBigInt64BE(offset?: number): bigint;
  readBigInt64LE(offset?: number): bigint;
  readBigUInt64BE(offset?: number): bigint;
  readBigUInt64LE(offset?: number): bigint;

  writeBigInt64BE(value: bigint, offset?: number): number;
  writeBigInt64LE(value: bigint, offset?: number): number;
  writeBigUInt64BE(value: bigint, offset?: number): number;
  writeBigUInt64LE(value: bigint, offset?: number): number;
}

/**
 * Throws if Node.js version is too low to support bigint
 */
function bigIntAndBufferInt64Check(bufferMethod: keyof Buffer) {
  if (typeof BigInt === 'undefined') {
    throw new Error('Platform does not support JS BigInt type.');
  }

  if (typeof Buffer.prototype[bufferMethod] === 'undefined') {
    throw new Error(`Platform does not support Buffer.prototype.${bufferMethod}.`);
  }
}

export {
  ERRORS, isFiniteInteger, checkEncoding, checkOffsetValue,
  checkLengthValue, checkTargetOffset, bigIntAndBufferInt64Check,
  toString, stringToUint8Array,
};
