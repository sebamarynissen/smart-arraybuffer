import {
  ERRORS, checkOffsetValue, checkLengthValue, checkTargetOffset,
  checkEncoding, isFiniteInteger, bigIntAndBufferInt64Check,
  toString,
} from './utils';

/**
 * Helper function for converting a uint8 array to a node.js buffer without 
 * copying the data. This means that we work on the same underlying arraybuffer.
 * 
 * @param { Uint8Array } array
 * @return { Buffer }
 */
function toBuffer(array: Uint8Array): Buffer {
  if (typeof Buffer === 'undefined') {
    throw new Error('Platform does not provide a Buffer global.');
  }
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

/**
 * Object interface for constructing new SmartBuffer instances.
 */
interface SmartBufferOptions {
  // Buffer Encoding to use for reading/writing strings if one is not provided.
  encoding?: BufferEncoding;
  // The initial size of the internal Buffer.
  size?: number;
  // If a Uint8Array is provided, this value will be used as the internal Buffer.
  buff?: Uint8Array;
}

// The default Buffer size if one is not provided.
const DEFAULT_SMARTBUFFER_SIZE: number = 4096;

// The default string encoding to use for reading/writing strings.
const DEFAULT_SMARTBUFFER_ENCODING: BufferEncoding = 'utf8';

// In the DataView class, we use true for LE, false for BE.
const LE = true;
const BE = false;

class SmartBuffer {
  public length: number = 0;

  private _encoding: BufferEncoding = DEFAULT_SMARTBUFFER_ENCODING;
  private _buff: Uint8Array;
  private _view: DataView;
  private _writeOffset: number = 0;
  private _readOffset: number = 0;

  /**
   * Creates a new SmartBuffer instance.
   *
   * @param options { SmartBufferOptions } The SmartBufferOptions to apply to this instance.
   */
  constructor(options?: SmartBufferOptions) {
    if (SmartBuffer.isSmartBufferOptions(options)) {
      // Checks for encoding
      if (options.encoding) {
        checkEncoding(options.encoding);
        this._encoding = options.encoding;
      }

      // Checks for initial size length
      if (options.size) {
        if (isFiniteInteger(options.size) && options.size > 0) {
          this._buff = new Uint8Array(options.size);
        } else {
          throw new Error(ERRORS.INVALID_SMARTBUFFER_SIZE);
        }
        // Check for initial Buffer
      } else if (options.buff) {
        if (options.buff instanceof Uint8Array) {
          this._buff = options.buff;
          this.length = options.buff.length;
        } else {
          throw new Error(ERRORS.INVALID_SMARTBUFFER_BUFFER);
        }
      } else {
        this._buff = new Uint8Array(DEFAULT_SMARTBUFFER_SIZE);
      }
    } else {
      // If something was passed but it's not a SmartBufferOptions object
      if (typeof options !== 'undefined') {
        throw new Error(ERRORS.INVALID_SMARTBUFFER_OBJECT);
      }

      // Otherwise default to sane options
      this._buff = new Uint8Array(DEFAULT_SMARTBUFFER_SIZE);
    }

    // Now store the corresponding dataview as well. Note that we have to make 
    // sure to properly copy the underlying offset and lengths of the 
    // arraybuffer, as the Uint8Array might be a partial view of an arraybuffer!
    this._view = new DataView(
      this._buff.buffer,
      this._buff.byteOffset,
      this._buff.byteLength,
    );

  }

  /**
   * Creates a new SmartBuffer instance with the provided internal Buffer size and optional encoding.
   *
   * @param size { Number } The size of the internal Buffer.
   * @param encoding { String } The BufferEncoding to use for strings.
   *
   * @return { SmartBuffer }
   */
  public static fromSize(size: number, encoding?: BufferEncoding): SmartBuffer {
    return new this({
      size: size,
      encoding: encoding
    });
  }

  /**
   * Creates a new SmartBuffer instance with the provided Buffer and optional encoding.
   *
   * @param buffer { Buffer } The Buffer to use as the internal Buffer value.
   * @param encoding { String } The BufferEncoding to use for strings.
   *
   * @return { SmartBuffer }
   */
  public static fromBuffer(buff: Uint8Array, encoding?: BufferEncoding): SmartBuffer {
    return new this({
      buff: buff,
      encoding: encoding
    });
  }

  /**
   * Creates a new SmartBuffer instance with the provided SmartBufferOptions options.
   *
   * @param options { SmartBufferOptions } The options to use when creating the SmartBuffer instance.
   */
  public static fromOptions(options: SmartBufferOptions): SmartBuffer {
    return new this(options);
  }

  /**
   * Type checking function that determines if an object is a SmartBufferOptions object.
   */
  static isSmartBufferOptions(options: SmartBufferOptions): options is SmartBufferOptions {
    const castOptions = <SmartBufferOptions>options;

    return (
      castOptions &&
      (castOptions.encoding !== undefined || castOptions.size !== undefined || castOptions.buff !== undefined)
    );
  }

  // Signed integers

  /**
   * Reads an Int8 value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readInt8(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getInt8, false, 1, offset);
  }

  /**
   * Reads an Int16BE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readInt16BE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getInt16, BE, 2, offset);
  }

  /**
   * Reads an Int16LE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readInt16LE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getInt16, LE, 2, offset);
  }

  /**
   * Reads an Int32BE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readInt32BE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getInt32, BE, 4, offset);
  }

  /**
   * Reads an Int32LE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readInt32LE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getInt32, LE, 4, offset);
  }

  /**
   * Reads a BigInt64BE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { BigInt }
   */
  readBigInt64BE(offset?: number): bigint {
    bigIntAndBufferInt64Check('readBigInt64BE');
    return this._readNumberValue(DataView.prototype.getBigInt64, BE, 8, offset);
  }

  /**
   * Reads a BigInt64LE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { BigInt }
   */
  readBigInt64LE(offset?: number): bigint {
    bigIntAndBufferInt64Check('readBigInt64LE');
    return this._readNumberValue(DataView.prototype.getBigInt64, LE, 8, offset);
  }

  /**
   * Writes an Int8 value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeInt8(value: number, offset?: number): SmartBuffer {
    this._writeNumberValue(DataView.prototype.setInt8, undefined, 1, value, offset);
    return this;
  }

  /**
   * Inserts an Int8 value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertInt8(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setInt8, undefined, 1, value, offset);
  }

  /**
   * Writes an Int16BE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeInt16BE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setInt16, BE, 2, value, offset);
  }

  /**
   * Inserts an Int16BE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertInt16BE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setInt16, BE, 2, value, offset);
  }

  /**
   * Writes an Int16LE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeInt16LE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setInt16, LE, 2, value, offset);
  }

  /**
   * Inserts an Int16LE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertInt16LE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setInt16, LE, 2, value, offset);
  }

  /**
   * Writes an Int32BE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeInt32BE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setInt32, BE, 4, value, offset);
  }

  /**
   * Inserts an Int32BE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertInt32BE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setInt32, BE, 4, value, offset);
  }

  /**
   * Writes an Int32LE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeInt32LE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setInt32, LE, 4, value, offset);
  }

  /**
   * Inserts an Int32LE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertInt32LE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setInt32, LE, 4, value, offset);
  }

  /**
   * Writes a BigInt64BE value to the current write position (or at optional offset).
   *
   * @param value { BigInt } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeBigInt64BE(value: bigint, offset?: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigInt64BE');
    return this._writeNumberValue(DataView.prototype.setBigInt64, BE, 8, value, offset);
  }

  /**
   * Inserts a BigInt64BE value at the given offset value.
   *
   * @param value { BigInt } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertBigInt64BE(value: bigint, offset: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigInt64BE');
    return this._insertNumberValue(DataView.prototype.setBigInt64, BE, 8, value, offset);
  }

  /**
   * Writes a BigInt64LE value to the current write position (or at optional offset).
   *
   * @param value { BigInt } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeBigInt64LE(value: bigint, offset?: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigInt64LE');
    return this._writeNumberValue(DataView.prototype.setBigInt64, LE, 8, value, offset);
  }

  /**
   * Inserts a Int64LE value at the given offset value.
   *
   * @param value { BigInt } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertBigInt64LE(value: bigint, offset: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigInt64LE');
    return this._insertNumberValue(DataView.prototype.setBigInt64, LE, 8, value, offset);
  }

  // Unsigned Integers

  /**
   * Reads an UInt8 value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readUInt8(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getUint8, false, 1, offset);
  }

  /**
   * Reads an UInt16BE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readUInt16BE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getUint16, BE, 2, offset);
  }

  /**
   * Reads an UInt16LE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readUInt16LE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getUint16, LE, 2, offset);
  }

  /**
   * Reads an UInt32BE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readUInt32BE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getUint32, BE, 4, offset);
  }

  /**
   * Reads an UInt32LE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readUInt32LE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getUint32, LE, 4, offset);
  }

  /**
   * Reads a BigUInt64BE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { BigInt }
   */
  readBigUInt64BE(offset?: number): bigint {
    bigIntAndBufferInt64Check('readBigUInt64BE');
    return this._readNumberValue(DataView.prototype.getBigUint64, BE, 8, offset);
  }

  /**
   * Reads a BigUInt64LE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { BigInt }
   */
  readBigUInt64LE(offset?: number): bigint {
    bigIntAndBufferInt64Check('readBigUInt64LE');
    return this._readNumberValue(DataView.prototype.getBigUint64, LE, 8, offset);
  }

  /**
   * Writes an UInt8 value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeUInt8(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setUint8, undefined, 1, value, offset);
  }

  /**
   * Inserts an UInt8 value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertUInt8(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setUint8, undefined, 1, value, offset);
  }

  /**
   * Writes an UInt16BE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeUInt16BE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setUint16, BE, 2, value, offset);
  }

  /**
   * Inserts an UInt16BE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertUInt16BE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setUint16, BE, 2, value, offset);
  }

  /**
   * Writes an UInt16LE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeUInt16LE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setUint16, LE, 2, value, offset);
  }

  /**
   * Inserts an UInt16LE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertUInt16LE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setUint16, LE, 2, value, offset);
  }

  /**
   * Writes an UInt32BE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeUInt32BE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setUint32, BE, 4, value, offset);
  }

  /**
   * Inserts an UInt32BE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertUInt32BE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setUint32, BE, 4, value, offset);
  }

  /**
   * Writes an UInt32LE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeUInt32LE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setUint32, LE, 4, value, offset);
  }

  /**
   * Inserts an UInt32LE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertUInt32LE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setUint32, LE, 4, value, offset);
  }

  /**
   * Writes a BigUInt64BE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeBigUInt64BE(value: bigint, offset?: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigUInt64BE');
    return this._writeNumberValue(DataView.prototype.setBigUint64, BE, 8, value, offset);
  }

  /**
   * Inserts a BigUInt64BE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertBigUInt64BE(value: bigint, offset: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigUInt64BE');
    return this._insertNumberValue(DataView.prototype.setBigUint64, BE, 8, value, offset);
  }

  /**
   * Writes a BigUInt64LE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeBigUInt64LE(value: bigint, offset?: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigUInt64LE');
    return this._writeNumberValue(DataView.prototype.setBigUint64, LE, 8, value, offset);
  }

  /**
   * Inserts a BigUInt64LE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertBigUInt64LE(value: bigint, offset: number): SmartBuffer {
    bigIntAndBufferInt64Check('writeBigUInt64LE');
    return this._insertNumberValue(DataView.prototype.setBigUint64, LE, 8, value, offset);
  }

  // Floating Point

  /**
   * Reads an FloatBE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readFloatBE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getFloat32, BE, 4, offset);
  }

  /**
   * Reads an FloatLE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readFloatLE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getFloat32, LE, 4, offset);
  }

  /**
   * Writes a FloatBE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeFloatBE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setFloat32, BE, 4, value, offset);
  }

  /**
   * Inserts a FloatBE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertFloatBE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setFloat32, BE, 4, value, offset);
  }

  /**
   * Writes a FloatLE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeFloatLE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setFloat32, LE, 4, value, offset);
  }

  /**
   * Inserts a FloatLE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertFloatLE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setFloat32, LE, 4, value, offset);
  }

  // Double Floating Point

  /**
   * Reads an DoublEBE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readDoubleBE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getFloat64, BE, 8, offset);
  }

  /**
   * Reads an DoubleLE value from the current read position or an optionally provided offset.
   *
   * @param offset { Number } The offset to read data from (optional)
   * @return { Number }
   */
  readDoubleLE(offset?: number): number {
    return this._readNumberValue(DataView.prototype.getFloat64, LE, 8, offset);
  }

  /**
   * Writes a DoubleBE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeDoubleBE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setFloat64, BE, 8, value, offset);
  }

  /**
   * Inserts a DoubleBE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertDoubleBE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setFloat64, BE, 8, value, offset);
  }

  /**
   * Writes a DoubleLE value to the current write position (or at optional offset).
   *
   * @param value { Number } The value to write.
   * @param offset { Number } The offset to write the value at.
   *
   * @return this
   */
  writeDoubleLE(value: number, offset?: number): SmartBuffer {
    return this._writeNumberValue(DataView.prototype.setFloat64, LE, 8, value, offset);
  }

  /**
   * Inserts a DoubleLE value at the given offset value.
   *
   * @param value { Number } The value to insert.
   * @param offset { Number } The offset to insert the value at.
   *
   * @return this
   */
  insertDoubleLE(value: number, offset: number): SmartBuffer {
    return this._insertNumberValue(DataView.prototype.setFloat64, LE, 8, value, offset);
  }

  // Strings

  /**
   * Reads a String from the current read position.
   *
   * @param arg1 { Number | String } The number of bytes to read as a String, or the BufferEncoding to use for
   *             the string (Defaults to instance level encoding).
   * @param encoding { String } The BufferEncoding to use for the string (Defaults to instance level encoding).
   *
   * @return { String }
   */
  readString(arg1?: number | BufferEncoding, encoding?: BufferEncoding): string {
    let lengthVal;

    // Length provided
    if (typeof arg1 === 'number') {
      checkLengthValue(arg1);
      lengthVal = Math.min(arg1, this.length - this._readOffset);
    } else {
      encoding = arg1;
      lengthVal = this.length - this._readOffset;
    }

    // Check encoding
    if (typeof encoding !== 'undefined') {
      checkEncoding(encoding);
    }

    const slice = this._buff.subarray(this._readOffset, this._readOffset + lengthVal);
    const value = toString(slice, encoding || this._encoding);

    this._readOffset += lengthVal;
    return value;
  }

  /**
   * Inserts a String
   *
   * @param value { String } The String value to insert.
   * @param offset { Number } The offset to insert the string at.
   * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
   *
   * @return this
   */
  insertString(value: string, offset: number, encoding?: BufferEncoding): SmartBuffer {
    checkOffsetValue(offset);

    return this._handleString(value, true, offset, encoding);
  }

  /**
   * Writes a String
   *
   * @param value { String } The String value to write.
   * @param arg2 { Number | String } The offset to write the string at, or the BufferEncoding to use.
   * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
   *
   * @return this
   */
  writeString(value: string, arg2?: number | BufferEncoding, encoding?: BufferEncoding): SmartBuffer {
    return this._handleString(value, false, arg2, encoding);
  }

  /**
   * Reads a null-terminated String from the current read position.
   *
   * @param encoding { String } The BufferEncoding to use for the string (Defaults to instance level encoding).
   *
   * @return { String }
   */
  readStringNT(encoding?: BufferEncoding): string {
    if (typeof encoding !== 'undefined') {
      checkEncoding(encoding);
    }

    // Set null character position to the end SmartBuffer instance.
    let nullPos = this.length;

    // Find next null character (if one is not found, default from above is used)
    for (let i = this._readOffset; i < this.length; i++) {
      if (this._buff[i] === 0x00) {
        nullPos = i;
        break;
      }
    }

    // Read string value
    const value = this._buff.subarray(this._readOffset, nullPos);

    // Increment internal Buffer read offset
    this._readOffset = nullPos + 1;

    return toString(value, encoding || this._encoding);
  }

  /**
   * Inserts a null-terminated String.
   *
   * @param value { String } The String value to write.
   * @param arg2 { Number | String } The offset to write the string to, or the BufferEncoding to use.
   * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
   *
   * @return this
   */
  insertStringNT(value: string, offset: number, encoding?: BufferEncoding): SmartBuffer {
    checkOffsetValue(offset);

    // Write Values
    this.insertString(value, offset, encoding);
    this.insertUInt8(0x00, offset + value.length);
    return this;
  }

  /**
   * Writes a null-terminated String.
   *
   * @param value { String } The String value to write.
   * @param arg2 { Number | String } The offset to write the string to, or the BufferEncoding to use.
   * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
   *
   * @return this
   */
  writeStringNT(value: string, arg2?: number | BufferEncoding, encoding?: BufferEncoding): SmartBuffer {
    // Write Values
    this.writeString(value, arg2, encoding);
    this.writeUInt8(0x00, typeof arg2 === 'number' ? arg2 + value.length : this.writeOffset);
    return this;
  }

  // Buffers

  /**
   * Reads a Uint8Array from the internal read position.
   *
   * @param length { Number } The length of data to read as a Buffer.
   *
   * @return { Uint8Array }
   */
  readUint8Array(length?: number): Uint8Array {
    if (typeof length !== 'undefined') {
      checkLengthValue(length);
    }

    const lengthVal = typeof length === 'number' ? length : this.length;
    const endPoint = Math.min(this.length, this._readOffset + lengthVal);

    // Read buffer value
    const value = this._buff.subarray(this._readOffset, endPoint);

    // Increment internal Buffer read offset
    this._readOffset = endPoint;
    return value;
  }

  /**
   * Reads a Node.js Buffer from the internal read position.
   *
   * @param length { Number } The length of data to read as a Buffer.
   *
   * @return { Buffer }
   */
  readBuffer(length?: number): Buffer {
    return toBuffer(this.readUint8Array(length));
  }

  /**
   * Writes a Buffer to the current write position.
   *
   * @param value { Uint8Array } The Buffer to write.
   * @param offset { Number } The offset to write the Buffer to.
   *
   * @return this
   */
  insertBuffer(value: Uint8Array, offset: number): SmartBuffer {
    checkOffsetValue(offset);

    return this._handleBuffer(value, true, offset);
  }

  /**
   * Writes a Buffer to the current write position.
   *
   * @param value { Uint8Array } The Buffer to write.
   * @param offset { Number } The offset to write the Buffer to.
   *
   * @return this
   */
  writeBuffer(value: Uint8Array, offset?: number): SmartBuffer {
    return this._handleBuffer(value, false, offset);
  }

  /**
   * Reads a null-terminated Uint8Array from the current read poisiton.
   *
   * @return { Uint8Array }
   */
  readUint8ArrayNT(): Uint8Array {
    // Set null character position to the end SmartBuffer instance.
    let nullPos = this.length;

    // Find next null character (if one is not found, default from above is used)
    for (let i = this._readOffset; i < this.length; i++) {
      if (this._buff[i] === 0x00) {
        nullPos = i;
        break;
      }
    }

    // Read value
    const value = this._buff.subarray(this._readOffset, nullPos);

    // Increment internal Buffer read offset
    this._readOffset = nullPos + 1;
    return value;
  }

  /**
   * Reads a null-terminated Buffer from the current read poisiton.
   *
   * @return { Buffer }
   */
  readBufferNT(): Buffer {
    return toBuffer(this.readUint8ArrayNT());
  }

  /**
   * Inserts a null-terminated Buffer.
   *
   * @param value { Uint8Array } The Buffer to write.
   * @param offset { Number } The offset to write the Buffer to.
   *
   * @return this
   */
  insertBufferNT(value: Uint8Array, offset: number): SmartBuffer {
    checkOffsetValue(offset);

    // Write Values
    this.insertBuffer(value, offset);
    this.insertUInt8(0x00, offset + value.length);

    return this;
  }

  /**
   * Writes a null-terminated Buffer.
   *
   * @param value { Uint8Array } The Buffer to write.
   * @param offset { Number } The offset to write the Buffer to.
   *
   * @return this
   */
  writeBufferNT(value: Uint8Array, offset?: number): SmartBuffer {
    // Checks for valid numberic value;
    if (typeof offset !== 'undefined') {
      checkOffsetValue(offset);
    }

    // Write Values
    this.writeBuffer(value, offset);
    this.writeUInt8(0x00, typeof offset === 'number' ? offset + value.length : this._writeOffset);

    return this;
  }

  /**
   * Clears the SmartBuffer instance to its original empty state.
   */
  clear(): SmartBuffer {
    this._writeOffset = 0;
    this._readOffset = 0;
    this.length = 0;
    return this;
  }

  /**
   * Gets the remaining data left to be read from the SmartBuffer instance.
   *
   * @return { Number }
   */
  remaining(): number {
    return this.length - this._readOffset;
  }

  /**
   * Gets the current read offset value of the SmartBuffer instance.
   *
   * @return { Number }
   */
  get readOffset(): number {
    return this._readOffset;
  }

  /**
   * Sets the read offset value of the SmartBuffer instance.
   *
   * @param offset { Number } - The offset value to set.
   */
  set readOffset(offset: number) {
    checkOffsetValue(offset);

    // Check for bounds.
    checkTargetOffset(offset, this);

    this._readOffset = offset;
  }

  /**
   * Gets the current write offset value of the SmartBuffer instance.
   *
   * @return { Number }
   */
  get writeOffset(): number {
    return this._writeOffset;
  }

  /**
   * Sets the write offset value of the SmartBuffer instance.
   *
   * @param offset { Number } - The offset value to set.
   */
  set writeOffset(offset: number) {
    checkOffsetValue(offset);

    // Check for bounds.
    checkTargetOffset(offset, this);

    this._writeOffset = offset;
  }

  /**
   * Gets the currently set string encoding of the SmartBuffer instance.
   *
   * @return { BufferEncoding } The string Buffer encoding currently set.
   */
  get encoding() {
    return this._encoding;
  }

  /**
   * Sets the string encoding of the SmartBuffer instance.
   *
   * @param encoding { BufferEncoding } The string Buffer encoding to set.
   */
  set encoding(encoding: BufferEncoding) {
    checkEncoding(encoding);

    this._encoding = encoding;
  }

  /**
   * Gets the underlying internal Uint8Array. (This includes unmanaged data)
   *
   * @return { Uint8Array } The Uint8Array value.
   */
  get internalUint8Array(): Uint8Array {
    return this._buff;
  }

  /**
   * Gets the underlying internal Buffer. (This includes unmanaged data)
   * Note that this is an alias for internalUint8Array for backwards 
   * compatibility. However, if the SmartBuffer was not constructed with an 
   * actual Node.js buffer, then this function throws.
   *
   * @return { Buffer } The Buffer value.
   */
  get internalBuffer(): Buffer {
    if (
      typeof (this._buff as Buffer).constructor.isBuffer === 'function' &&
      (this._buff as Buffer).constructor.isBuffer(this._buff)
    ) return this._buff;
    return toBuffer(this._buff);
  }

  /**
   * Gets the value of the internal managed Uint8Array (Includes managed data only)
   *
   * @param { Uint8Array }
   */
  toUint8Array(): Uint8Array {
    return this._buff.subarray(0, this.length);
  }

  /**
   * Gets the value of the internal managed Buffer (Includes managed data only)
   *
   * @param { Buffer }
   */
  toBuffer(): Buffer {
    return toBuffer(this.toUint8Array());
  }

  /**
   * Gets the value of the internal managed Uint8Array as ArrayBuffer.
   */
  toArrayBuffer(): ArrayBuffer {
    const arrayBuffer = new ArrayBuffer(this._buff.byteLength);
    const view = new Uint8Array(arrayBuffer);
    view.set(this._buff);
    return arrayBuffer;
  }

  /**
   * Gets the String value of the internal managed Buffer
   *
   * @param encoding { String } The BufferEncoding to display the Buffer as (defaults to instance level encoding).
   */
  toString(encoding?: BufferEncoding): string {
    const encodingVal = typeof encoding === 'string' ? encoding : this._encoding;

    // Check for invalid encoding.
    checkEncoding(encodingVal);
    return toString(this._buff.subarray(0, this.length), encoding);
  }

  /**
   * Destroys the SmartBuffer instance.
   */
  destroy(): SmartBuffer {
    this.clear();
    return this;
  }

  /**
   * Handles inserting and writing strings.
   *
   * @param value { String } The String value to insert.
   * @param isInsert { Boolean } True if inserting a string, false if writing.
   * @param arg2 { Number | String } The offset to insert the string at, or the BufferEncoding to use.
   * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
   */
  private _handleString(
    value: string,
    isInsert: boolean,
    arg3?: number | BufferEncoding,
    encoding?: BufferEncoding
  ): SmartBuffer {
    let offsetVal = this._writeOffset;
    let encodingVal = this._encoding;

    // Check for offset
    if (typeof arg3 === 'number') {
      offsetVal = arg3;
      // Check for encoding
    } else if (typeof arg3 === 'string') {
      checkEncoding(arg3);
      encodingVal = arg3;
    }

    // Check for encoding (third param)
    if (typeof encoding === 'string') {
      checkEncoding(encoding);
      encodingVal = encoding;
    }

    // Calculate bytelength of string.
    const byteLength = Buffer.byteLength(value, encodingVal);

    // Ensure there is enough internal Buffer capacity.
    if (isInsert) {
      this.ensureInsertable(byteLength, offsetVal);
    } else {
      this._ensureWriteable(byteLength, offsetVal);
    }

    // Write value
    const dv = new Uint8Array(this._buff.buffer, offsetVal, byteLength);
    new TextEncoder().encodeInto(value, dv);

    // Increment internal Buffer write offset;
    if (isInsert) {
      this._writeOffset += byteLength;
    } else {
      // If an offset was given, check to see if we wrote beyond the current writeOffset.
      if (typeof arg3 === 'number') {
        this._writeOffset = Math.max(this._writeOffset, offsetVal + byteLength);
      } else {
        // If no offset was given, we wrote to the end of the SmartBuffer so increment writeOffset.
        this._writeOffset += byteLength;
      }
    }

    return this;
  }

  /**
   * Handles writing or insert of a Buffer.
   *
   * @param value { Buffer } The Buffer to write.
   * @param offset { Number } The offset to write the Buffer to.
   */
  private _handleBuffer(value: Uint8Array, isInsert: boolean, offset?: number): SmartBuffer {
    const offsetVal = typeof offset === 'number' ? offset : this._writeOffset;

    // Ensure there is enough internal Buffer capacity.
    if (isInsert) {
      this.ensureInsertable(value.length, offsetVal);
    } else {
      this._ensureWriteable(value.length, offsetVal);
    }

    // Write buffer value
    let dv = new Uint8Array(this._buff.buffer);
    dv.set(value, offsetVal);

    // Increment internal Buffer write offset;
    if (isInsert) {
      this._writeOffset += value.length;
    } else {
      // If an offset was given, check to see if we wrote beyond the current writeOffset.
      if (typeof offset === 'number') {
        this._writeOffset = Math.max(this._writeOffset, offsetVal + value.length);
      } else {
        // If no offset was given, we wrote to the end of the SmartBuffer so increment writeOffset.
        this._writeOffset += value.length;
      }
    }

    return this;
  }

  /**
   * Ensures that the internal Buffer is large enough to read data.
   *
   * @param length { Number } The length of the data that needs to be read.
   * @param offset { Number } The offset of the data that needs to be read.
   */
  private ensureReadable(length: number, offset?: number) {
    // Offset value defaults to managed read offset.
    let offsetVal = this._readOffset;

    // If an offset was provided, use it.
    if (typeof offset !== 'undefined') {
      // Checks for valid numberic value;
      checkOffsetValue(offset);

      // Overide with custom offset.
      offsetVal = offset;
    }

    // Checks if offset is below zero, or the offset+length offset is beyond the total length of the managed data.
    if (offsetVal < 0 || offsetVal + length > this.length) {
      throw new Error(ERRORS.INVALID_READ_BEYOND_BOUNDS);
    }
  }

  /**
   * Ensures that the internal Buffer is large enough to insert data.
   *
   * @param dataLength { Number } The length of the data that needs to be written.
   * @param offset { Number } The offset of the data to be written.
   */
  private ensureInsertable(dataLength: number, offset: number) {
    // Checks for valid numberic value;
    checkOffsetValue(offset);

    // Ensure there is enough internal Buffer capacity.
    this._ensureCapacity(this.length + dataLength);

    // If an offset was provided and its not the very end of the buffer, copy data into appropriate location in regards to the offset.
    if (offset < this.length) {
      // this._buff.copy(this._buff, offset + dataLength, offset, this._buff.length);
      this._buff.set(this._buff.subarray(offset, this.length), offset + dataLength) ;
    }

    // Adjust tracked smart buffer length
    if (offset + dataLength > this.length) {
      this.length = offset + dataLength;
    } else {
      this.length += dataLength;
    }
  }

  /**
   * Ensures that the internal Buffer is large enough to write data.
   *
   * @param dataLength { Number } The length of the data that needs to be written.
   * @param offset { Number } The offset of the data to be written (defaults to writeOffset).
   */
  private _ensureWriteable(dataLength: number, offset?: number) {
    const offsetVal = typeof offset === 'number' ? offset : this._writeOffset;

    // Ensure enough capacity to write data.
    this._ensureCapacity(offsetVal + dataLength);

    // Adjust SmartBuffer length (if offset + length is larger than managed length, adjust length)
    if (offsetVal + dataLength > this.length) {
      this.length = offsetVal + dataLength;
    }
  }

  /**
   * Ensures that the internal Buffer is large enough to write at least the given amount of data.
   *
   * @param minLength { Number } The minimum length of the data needs to be written.
   */
  private _ensureCapacity(minLength: number) {
    const oldLength = this._buff.length;

    if (minLength > oldLength) {
      let data = this._buff;
      let newLength = (oldLength * 3) / 2 + 1;
      if (newLength < minLength) {
        newLength = minLength;
      }
      this._buff = new Uint8Array(newLength);

      this._buff.set(data.subarray(0, oldLength), 0);
      this._view = new DataView(
        this._buff.buffer,
        this._buff.byteOffset,
        this._buff.byteOffset,
      );
    }
  }

  /**
   * Reads a numeric number value using the provided function.
   *
   * @typeparam T { number | bigint } The type of the value to be read
   *
   * @param func { Function(offset: number) => number } The function to read data on the internal Buffer with.
   * @param byteSize { Number } The number of bytes read.
   * @param offset { Number } The offset to read from (optional). When this is not provided, the managed readOffset is used instead.
   *
   * @returns { T } the number value
   */
  private _readNumberValue<T>(func: (offset: number) => T, endianness: boolean | undefined, byteSize: number, offset?: number): T {
    this.ensureReadable(byteSize, offset);

    // Call Buffer.readXXXX();
    const value = func.call(this._view, typeof offset === 'number' ? offset : this._readOffset, endianness);

    // Adjust internal read offset if an optional read offset was not provided.
    if (typeof offset === 'undefined') {
      this._readOffset += byteSize;
    }

    return value;
  }

  /**
   * Inserts a numeric number value based on the given offset and value.
   *
   * @typeparam T { number | bigint } The type of the value to be written
   *
   * @param func { Function(offset: T, offset?) => number} The function to write data on the internal Buffer with.
   * @param byteSize { Number } The number of bytes written.
   * @param value { T } The number value to write.
   * @param offset { Number } the offset to write the number at (REQUIRED).
   *
   * @returns SmartBuffer this buffer
   */
  private _insertNumberValue<T extends number | bigint>(
    func: (value: T, offset?: number) => number,
    endianness: boolean | undefined,
    byteSize: number,
    value: T,
    offset: number
  ): SmartBuffer {
    // Check for invalid offset values.
    checkOffsetValue(offset);

    // Ensure there is enough internal Buffer capacity. (raw offset is passed)
    this.ensureInsertable(byteSize, offset);

    // Call buffer.writeXXXX();
    func.call(this._view, offset, value, endianness);

    // Adjusts internally managed write offset.
    this._writeOffset += byteSize;
    return this;
  }

  /**
   * Writes a numeric number value based on the given offset and value.
   *
   * @typeparam T { number | bigint } The type of the value to be written
   *
   * @param func { Function(offset: T, offset?) => number} The function to write data on the internal Buffer with.
   * @param byteSize { Number } The number of bytes written.
   * @param value { T } The number value to write.
   * @param offset { Number } the offset to write the number at (REQUIRED).
   *
   * @returns SmartBuffer this buffer
   */
  private _writeNumberValue<T extends number | bigint>(
    func: (value: T, offset?: number) => number,
    endianness: boolean | undefined,
    byteSize: number,
    value: T,
    offset?: number
  ): SmartBuffer {
    // If an offset was provided, validate it.
    if (typeof offset === 'number') {
      // Check if we're writing beyond the bounds of the managed data.
      if (offset < 0) {
        throw new Error(ERRORS.INVALID_WRITE_BEYOND_BOUNDS);
      }

      checkOffsetValue(offset);
    }

    // Default to writeOffset if no offset value was given.
    const offsetVal = typeof offset === 'number' ? offset : this._writeOffset;

    // Ensure there is enough internal Buffer capacity. (raw offset is passed)
    this._ensureWriteable(byteSize, offsetVal);

    func.call(this._view, offsetVal, value, endianness);

    // If an offset was given, check to see if we wrote beyond the current writeOffset.
    if (typeof offset === 'number') {
      this._writeOffset = Math.max(this._writeOffset, offsetVal + byteSize);
    } else {
      // If no numeric offset was given, we wrote to the end of the SmartBuffer so increment writeOffset.
      this._writeOffset += byteSize;
    }

    return this;
  }
}

export { SmartBufferOptions, SmartBuffer };
