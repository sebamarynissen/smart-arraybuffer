smart-arraybuffer
=============

smart-arraybuffer is a fork of [smart-buffer](https://www.npmjs.com/package/smart-buffer) that does not rely on the presence of a `Buffer` global, but uses an `ArrayBuffer` combined with `DataView` instead.
It therefore works in the browser without needing a polyfill like [buffer for the browser](https://www.npmjs.com/package/buffer).
I was inspired to create this module by [this post](https://sindresorhus.com/blog/goodbye-nodejs-buffer) from Sindre Sorhus as I saw that something like that was not available yet.

**Key Features**:
 - Has the exact same api and features as [smart-buffer](https://www.npmjs.com/package/smart-buffer) so it can be used as a drop-in replacement in most cases (see below).
 - Browser support without the need for a polyfill
 - [ESM-only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c). Use `--experimental-require-module`, or dynamic `import()` if you're still on cjs.

**Requirements**:
 - Node v18+. It may work on lower versions, but no support for non-LTS versions is guaranteed.

## Installing:

`npm install smart-arraybuffer`

Note: The published NPM package includes the built javascript library.
If you cloned this repo and wish to build the library manually use:

`npm run build`

## Key differences from [smart-buffer](https://www.npmjs.com/package/smart-buffer)

While smart-arraybuffer has almost the exact same api as the original [smart-buffer](https://www.npmjs.com/package/smart-buffer) package, there are a few things you need to be aware of if you want to use it as a drop-in replacement:

 - The property `.internalBuffer` is not available. It has been replaced by `.internalArrayBuffer`, which returns the underlying `ArrayBuffer` instance instead of the underlying `Buffer` instance. If you were relying on `.internalBuffer`, you cannot use it as a drop-in replacement.
 - The `.writeString()` functions don't support all encodings that `Buffer` does, only `utf8`, `utf-8`, `ascii`, `base64`, `hex` and `binary` are supported. This is because the module relies on [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) to perform the encoding, which only supports utf8. Given that `base64`, `hex` and `binary` are so common, they have been implemented manually. If you need support for other encodings, like `utf-16le`, then you still need to work with Node's native Buffer, which kind of defeats the purpose of this module. On the upside, the `.readString()` methods support all encodings that [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) supports, which is a lot more than what Node's Buffer does.
 - Adds a bunch of new methods like `.toArrayBuffer()`, `.toUint8Array()`, `.readUint8Array()`, `.writeUint8Array()` that are meant to replace their buffer equivalents.
 - If you're working in Node.js - meaning the `Buffer` global is available - then you can still use the buffer methods (`.toBuffer()`, `.readBuffer()`, `writeBuffer()` etc.). However, doing so kind of defeats the purpose of the module, but it may help for incrementally [migrating away from Node.js buffer](https://sindresorhus.com/blog/goodbye-nodejs-buffer): just keep using `.toBuffer()` where the calling code actually needs a Node.js buffer, and use `.toUint8Array()` or `.toArrayBuffer()` where already possible.

## Using smart-arraybuffer

```javascript
// Javascript
import { SmartBuffer } from 'smart-arraybuffer';

// Typescript
import { SmartBuffer, SmartBufferOptions} from 'smart-arraybuffer';
```

### Simple Example

Building a packet that uses the following protocol specification:

`[PacketType:2][PacketLength:2][Data:XX]`

To build this packet using the vanilla Buffer class, you would have to count up the length of the data payload beforehand. You would also need to keep track of the current "cursor" position in your Buffer so you write everything in the right places. With smart-buffer you don't have to do either of those things.

```javascript
function createLoginPacket(username, password, age, country) {
    const packet = new SmartBuffer();
    packet.writeUInt16LE(0x0060); // Some packet type
    packet.writeStringNT(username);
    packet.writeStringNT(password);
    packet.writeUInt8(age);
    packet.writeStringNT(country);
    packet.insertUInt16LE(packet.length - 2, 2);

    return packet.toArrayBuffer();
}
```
With the above function, you now can do this:
```javascript
const login = createLoginPacket("Josh", "secret123", 22, "United States");

// ArrayBuffer { [Uint8Contents]: <60 00 1e 00 4a 6f 73 68 00 73 65 63 72 65 74 31 32 33 00 16 55 6e 69 74 65 64 20 53 74 61 74 65 73 00>, byteLength: 34 }
```
Notice that the `[PacketLength:2]` value (1e 00) was inserted at position 2.

Reading back the packet we created above is just as easy:
```javascript

const reader = SmartBuffer.fromBuffer(login);

const logininfo = {
    packetType: reader.readUInt16LE(),
    packetLength: reader.readUInt16LE(),
    username: reader.readStringNT(),
    password: reader.readStringNT(),
    age: reader.readUInt8(),
    country: reader.readStringNT()
};

/*
{
    packetType: 96, (0x0060)
    packetLength: 30,
    username: 'Josh',
    password: 'secret123',
    age: 22,
    country: 'United States'
}
*/
```

## Constructing a smart-buffer

There are a few different ways to construct a SmartBuffer instance.

```javascript
// Creating SmartBuffer from existing Buffer
const buff = SmartBuffer.fromBuffer(buffer); // Creates instance from buffer. (Uses default utf8 encoding)
const buff = SmartBuffer.fromBuffer(buffer, 'ascii'); // Creates instance from buffer with ascii encoding for strings.

// Creating SmartBuffer with specified internal Buffer size. (Note: this is not a hard cap, the internal buffer will grow as needed).
const buff = SmartBuffer.fromSize(1024); // Creates instance with internal Buffer size of 1024.
const buff = SmartBuffer.fromSize(1024, 'utf8'); // Creates instance with internal Buffer size of 1024, and utf8 encoding for strings.

// Creating SmartBuffer with options object. This one specifies size and encoding.
const buff = SmartBuffer.fromOptions({
    size: 1024,
    encoding: 'ascii'
});

// Creating SmartBuffer with options object. This one specified an existing Buffer.
const buff = SmartBuffer.fromOptions({
    buff: buffer
});

// Creating SmartBuffer from a string.
const buff = SmartBuffer.fromBuffer(Buffer.from('some string', 'utf8'));

// Just want a regular SmartBuffer with all default options?
const buff = new SmartBuffer();
```

# Api Reference:

**Note:** SmartBuffer is fully documented with Typescript definitions as well as jsdocs so your favorite editor/IDE will have intellisense.

**Table of Contents**

1. [Constructing](#constructing)
2. **Numbers**
    1. [Integers](#integers)
    2. [Floating Points](#floating-point-numbers)
3. **Strings**
    1. [Strings](#strings)
    2. [Null Terminated Strings](#null-terminated-strings)
4. [ArrayBuffers](#arraybuffers)
5. [Uint8Arrays](#uint8arrays)
6. [Buffers](#buffers)
7. [Offsets](#offsets)
8. [Other](#other)


## Constructing

### constructor()
### constructor([options])
- ```options``` *{SmartBufferOptions}* An optional options object to construct a SmartBuffer with.

Examples:
```javascript
const buff = new SmartBuffer();
const buff = new SmartBuffer({
    size: 1024,
    encoding: 'ascii'
});
```

### Class Method: fromBuffer(buffer[, encoding])
- ```buffer``` *{Buffer}* The Buffer instance to wrap.
- ```encoding``` *{string}* The string encoding to use. ```Default: 'utf8'```

Examples:
```javascript
const someBuffer = Buffer.from('some string');
const buff = SmartBuffer.fromBuffer(someBuffer); // Defaults to utf8
const buff = SmartBuffer.fromBuffer(someBuffer, 'ascii');
```

### Class Method: fromSize(size[, encoding])
- ```size``` *{number}* The size to initialize the internal Buffer.
- ```encoding``` *{string}* The string encoding to use. ```Default: 'utf8'```

Examples:
```javascript
const buff = SmartBuffer.fromSize(1024); // Defaults to utf8
const buff = SmartBuffer.fromSize(1024, 'ascii');
```

### Class Method: fromOptions(options)
- ```options``` *{SmartBufferOptions}* The Buffer instance to wrap.

```typescript
interface SmartBufferOptions {
    encoding?: BufferEncoding; // Defaults to utf8
    size?: number; // Defaults to 4096
    buff?: Buffer;
}
```

Examples:
```javascript
const buff = SmartBuffer.fromOptions({
    size: 1024
};
const buff = SmartBuffer.fromOptions({
    size: 1024,
    encoding: 'utf8'
});
const buff = SmartBuffer.fromOptions({
    encoding: 'utf8'
});

const someBuff = Buffer.from('some string', 'utf8');
const buff = SmartBuffer.fromOptions({
    buffer: someBuff,
    encoding: 'utf8'
});
```

## Integers

### buff.readInt8([offset])
### buff.readUInt8([offset])
- ```offset``` *{number}* Optional position to start reading data from. **Default**: ```Auto managed offset```
- Returns *{number}*

Read a Int8 value.

### buff.readInt16BE([offset])
### buff.readInt16LE([offset])
### buff.readUInt16BE([offset])
### buff.readUInt16LE([offset])
- ```offset``` *{number}* Optional position to start reading data from. **Default**: ```Auto managed offset```
- Returns *{number}*

Read a 16 bit integer value.

### buff.readInt32BE([offset])
### buff.readInt32LE([offset])
### buff.readUInt32BE([offset])
### buff.readUInt32LE([offset])
- ```offset``` *{number}* Optional position to start reading data from. **Default**: ```Auto managed offset```
- Returns *{number}*

Read a 32 bit integer value.


### buff.writeInt8(value[, offset])
### buff.writeUInt8(value[, offset])
- ```value``` *{number}* The value to write.
- ```offset``` *{number}* An optional offset to write this value to. **Default:** ```Auto managed offset```
- Returns *{this}*

Write a Int8 value.

### buff.insertInt8(value, offset)
### buff.insertUInt8(value, offset)
- ```value``` *{number}* The value to insert.
- ```offset``` *{number}* The offset to insert this data at.
- Returns *{this}*

Insert a Int8 value.


### buff.writeInt16BE(value[, offset])
### buff.writeInt16LE(value[, offset])
### buff.writeUInt16BE(value[, offset])
### buff.writeUInt16LE(value[, offset])
- ```value``` *{number}* The value to write.
- ```offset``` *{number}* An optional offset to write this value to. **Default:** ```Auto managed offset```
- Returns *{this}*

Write a 16 bit integer value.

### buff.insertInt16BE(value, offset)
### buff.insertInt16LE(value, offset)
### buff.insertUInt16BE(value, offset)
### buff.insertUInt16LE(value, offset)
- ```value``` *{number}* The value to insert.
- ```offset``` *{number}* The offset to insert this data at.
- Returns *{this}*

Insert a 16 bit integer value.


### buff.writeInt32BE(value[, offset])
### buff.writeInt32LE(value[, offset])
### buff.writeUInt32BE(value[, offset])
### buff.writeUInt32LE(value[, offset])
- ```value``` *{number}* The value to write.
- ```offset``` *{number}* An optional offset to write this value to. **Default:** ```Auto managed offset```
- Returns *{this}*

Write a 32 bit integer value.

### buff.insertInt32BE(value, offset)
### buff.insertInt32LE(value, offset)
### buff.insertUInt32BE(value, offset)
### buff.nsertUInt32LE(value, offset)
- ```value``` *{number}* The value to insert.
- ```offset``` *{number}* The offset to insert this data at.
- Returns *{this}*

Insert a 32 bit integer value.


## Floating Point Numbers

### buff.readFloatBE([offset])
### buff.readFloatLE([offset])
- ```offset``` *{number}* Optional position to start reading data from. **Default**: ```Auto managed offset```
- Returns *{number}*

Read a Float value.

### buff.readDoubleBE([offset])
### buff.readDoubleLE([offset])
- ```offset``` *{number}* Optional position to start reading data from. **Default**: ```Auto managed offset```
- Returns *{number}*

Read a Double value.


### buff.writeFloatBE(value[, offset])
### buff.writeFloatLE(value[, offset])
- ```value``` *{number}* The value to write.
- ```offset``` *{number}* An optional offset to write this value to. **Default:** ```Auto managed offset```
- Returns *{this}*

Write a Float value.

### buff.insertFloatBE(value, offset)
### buff.insertFloatLE(value, offset)
- ```value``` *{number}* The value to insert.
- ```offset``` *{number}* The offset to insert this data at.
- Returns *{this}*

Insert a Float value.


### buff.writeDoubleBE(value[, offset])
### buff.writeDoubleLE(value[, offset])
- ```value``` *{number}* The value to write.
- ```offset``` *{number}* An optional offset to write this value to. **Default:** ```Auto managed offset```
- Returns *{this}*

Write a Double value.

### buff.insertDoubleBE(value, offset)
### buff.insertDoubleLE(value, offset)
- ```value``` *{number}* The value to insert.
- ```offset``` *{number}* The offset to insert this data at.
- Returns *{this}*

Insert a Double value.

## Strings

### buff.readString()
### buff.readString(size[, encoding])
### buff.readString(encoding)
- ```size``` *{number}* The number of bytes to read. **Default:** ```Reads to the end of the Buffer.```
- ```encoding``` *{string}* The string encoding to use. **Default:** ```utf8```.

Read a string value.

Examples:
```javascript
const buff = SmartBuffer.fromBuffer(Buffer.from('hello there', 'utf8'));
buff.readString(); // 'hello there'
buff.readString(2); // 'he'
buff.readString(2, 'utf8'); // 'he'
buff.readString('utf8'); // 'hello there'
```

### buff.writeString(value)
### buff.writeString(value[, offset])
### buff.writeString(value[, encoding])
### buff.writeString(value[, offset[, encoding]])
- ```value``` *{string}* The string value to write.
- ```offset``` *{number}* The offset to write this value to. **Default:** ```Auto managed offset```
- ```encoding``` *{string}* An optional string encoding to use. **Default:** ```utf8```

Write a string value.

Examples:
```javascript
buff.writeString('hello'); // Auto managed offset
buff.writeString('hello', 2);
buff.writeString('hello', 'utf8') // Auto managed offset
buff.writeString('hello', 2, 'utf8');
```

### buff.insertString(value, offset[, encoding])
- ```value``` *{string}* The string value to write.
- ```offset``` *{number}* The offset to write this value to.
- ```encoding``` *{string}* An optional string encoding to use. **Default:** ```utf8```

Insert a string value.

Examples:
```javascript
buff.insertString('hello', 2);
buff.insertString('hello', 2, 'utf8');
```

## Null Terminated Strings

### buff.readStringNT()
### buff.readStringNT(encoding)
- ```encoding``` *{string}* The string encoding to use. **Default:** ```utf8```.

Read a null terminated string value. (If a null is not found, it will read to the end of the Buffer).

Examples:
```javascript
const buff = SmartBuffer.fromBuffer(Buffer.from('hello\0 there', 'utf8'));
buff.readStringNT(); // 'hello'

// If we called this again:
buff.readStringNT(); // ' there'
```

### buff.writeStringNT(value)
### buff.writeStringNT(value[, offset])
### buff.writeStringNT(value[, encoding])
### buff.writeStringNT(value[, offset[, encoding]])
- ```value``` *{string}* The string value to write.
- ```offset``` *{number}* The offset to write this value to. **Default:** ```Auto managed offset```
- ```encoding``` *{string}* An optional string encoding to use. **Default:** ```utf8```

Write a null terminated string value.

Examples:
```javascript
buff.writeStringNT('hello'); // Auto managed offset   <Buffer 68 65 6c 6c 6f 00>
buff.writeStringNT('hello', 2); // <Buffer 00 00 68 65 6c 6c 6f 00>
buff.writeStringNT('hello', 'utf8') // Auto managed offset
buff.writeStringNT('hello', 2, 'utf8');
```

### buff.insertStringNT(value, offset[, encoding])
- ```value``` *{string}* The string value to write.
- ```offset``` *{number}* The offset to write this value to.
- ```encoding``` *{string}* An optional string encoding to use. **Default:** ```utf8```

Insert a null terminated string value.

Examples:
```javascript
buff.insertStringNT('hello', 2);
buff.insertStringNT('hello', 2, 'utf8');
```

## ArrayBuffers

### buff.readArrayBuffer([length])
- ```length``` *{number}* The number of bytes to read into an ArrayBuffer. **Default:** ```Reads to the end of the Buffer```

Read an ArrayBuffer of a specified size.

### buff.writeArrayBuffer(value[, offset])
- ```value``` *{ArrayBuffer}* The array buffer value to write.
- ```offset``` *{number}* An optional offset to write the value to. **Default:** ```Auto managed offset```

### buff.insertArrayBuffer(value, offset)
- ```value``` *{ArrayBuffer}* The array buffer value to write.
- ```offset``` *{number}* The offset to write the value to.


### buff.readArrayBufferNT()

Read a null terminated ArrayBuffer.

### buff.writeArrayBufferNT(value[, offset])
- ```value``` *{ArrayBuffer}* The array buffer value to write.
- ```offset``` *{number}* An optional offset to write the value to. **Default:** ```Auto managed offset```

Write a null terminated ArrayBuffer.


### buff.insertArrayBufferNT(value, offset)
- ```value``` *{ArrayBuffer}* The array buffer value to write.
- ```offset``` *{number}* The offset to write the value to.

Insert a null terminated ArrayBuffer.

## Uint8Arrays

### buff.readUint8Array([length])
- ```length``` *{number}* The number of bytes to read into an Uint8Array. **Default:** ```Reads to the end of the Buffer```

Read an Uint8Array of a specified size.

**NOTE**: The methods only works in environments that provide a Buffer global, like Node.js. It is advised to use `readUint8Array()` instead.

### buff.writeUint8Array(value[, offset])
- ```value``` *{Uint8Array}* The array buffer value to write.
- ```offset``` *{number}* An optional offset to write the value to. **Default:** ```Auto managed offset```

### buff.insertUint8Array(value, offset)
- ```value``` *{Uint8Array}* The array buffer value to write.
- ```offset``` *{number}* The offset to write the value to.


### buff.readUint8ArrayNT()

Read a null terminated Uint8Array.

### buff.writeUint8ArrayNT(value[, offset])
- ```value``` *{Uint8Array}* The array buffer value to write.
- ```offset``` *{number}* An optional offset to write the value to. **Default:** ```Auto managed offset```

Write a null terminated Uint8Array.


### buff.insertUint8ArrayNT(value, offset)
- ```value``` *{Uint8Array}* The array buffer value to write.
- ```offset``` *{number}* The offset to write the value to.

Insert a null terminated Uint8Array.

## Buffers

### buff.readBuffer([length])
- ```length``` *{number}* The number of bytes to read into a Buffer. **Default:** ```Reads to the end of the Buffer```

Read a Buffer of a specified size.

**NOTE**: The methods only works in environments that provide a Buffer global, like Node.js. It is advised to use `readUint8Array()` instead.

### buff.writeBuffer(value[, offset])
- ```value``` *{Buffer}* The buffer value to write.
- ```offset``` *{number}* An optional offset to write the value to. **Default:** ```Auto managed offset```

### buff.insertBuffer(value, offset)
- ```value``` *{Buffer}* The buffer value to write.
- ```offset``` *{number}* The offset to write the value to.


### buff.readBufferNT()

Read a null terminated Buffer.

### buff.writeBufferNT(value[, offset])
- ```value``` *{Buffer}* The buffer value to write.
- ```offset``` *{number}* An optional offset to write the value to. **Default:** ```Auto managed offset```

Write a null terminated Buffer.


### buff.insertBufferNT(value, offset)
- ```value``` *{Buffer}* The buffer value to write.
- ```offset``` *{number}* The offset to write the value to.

Insert a null terminated Buffer.


## Offsets

### buff.readOffset
### buff.readOffset(offset)
- ```offset``` *{number}* The new read offset value to set.
- Returns: ```The current read offset```

Gets or sets the current read offset.

Examples:
```javascript
const currentOffset = buff.readOffset; // 5

buff.readOffset = 10;

console.log(buff.readOffset) // 10
```

### buff.writeOffset
### buff.writeOffset(offset)
- ```offset``` *{number}* The new write offset value to set.
- Returns: ```The current write offset```

Gets or sets the current write offset.

Examples:
```javascript
const currentOffset = buff.writeOffset; // 5

buff.writeOffset = 10;

console.log(buff.writeOffset) // 10
```

### buff.encoding
### buff.encoding(encoding)
- ```encoding``` *{string}* The new string encoding to set.
- Returns: ```The current string encoding```

Gets or sets the current string encoding.

Examples:
```javascript
const currentEncoding = buff.encoding; // 'utf8'

buff.encoding = 'ascii';

console.log(buff.encoding) // 'ascii'
```

## Other

### buff.clear()

Clear and resets the SmartBuffer instance.

### buff.remaining()
- Returns ```Remaining data left to be read```

Gets the number of remaining bytes to be read.


### buff.internalBuffer
- Returns: *{Buffer}*

Gets the internally managed Buffer (Includes unmanaged data).

Examples:
```javascript
const buff = SmartBuffer.fromSize(16);
buff.writeString('hello');
console.log(buff.InternalBuffer); // <Buffer 68 65 6c 6c 6f 00 00 00 00 00 00 00 00 00 00 00>
```

### buff.toArrayBuffer()
- Returns: *{ArrayBuffer}*

Gets a sliced ArrayBuffer instance of the internally managed ArrayBuffer. (Only includes managed data)

Examples:
```javascript
const buff = SmartBuffer.fromSize(16);
buff.writeString('hello');
console.log(buff.toArrayBuffer()); // ArrayBuffer { [Uint8Contents]: <68 65 6c 6c 6f>, byteLength: 5 }
```

### buff.toUint8Array()
- Returns: *{Uint8Array}*

Gets a sliced Uint8Array instance of the internally managed ArrayBuffer. (Only includes managed data)

Examples:
```javascript
const buff = SmartBuffer.fromSize(16);
buff.writeString('hello');
console.log(buff.toUint8Array()); // Uint8Array(5) [ 104, 101, 108, 108, 111 ]
```

### buff.toBuffer()
- Returns: *{Buffer}*

Gets a sliced Buffer instance of the internally managed Buffer. (Only includes managed data)

**NOTE**: This only works in environments that provide a Buffer global, like Node.js.

Examples:
```javascript
const buff = SmartBuffer.fromSize(16);
buff.writeString('hello');
console.log(buff.toBuffer()); // <Buffer 68 65 6c 6c 6f>
```

### buff.toString([encoding])
- ```encoding``` *{string}* The string encoding to use when converting to a string. **Default:** ```utf8```
- Returns *{string}*

Gets a string representation of all data in the SmartBuffer.

### buff.destroy()

Destroys the SmartBuffer instance.



## License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).
