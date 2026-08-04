const version = 5;
const size = 17 + version * 4;
const dataCodewords = 108;
const errorCorrectionCodewords = 26;
const mask = 0;

type Matrix = boolean[][];

class BitBuffer {
  readonly bits: number[] = [];

  append(value: number, length: number) {
    for (let index = length - 1; index >= 0; index -= 1) {
      this.bits.push((value >>> index) & 1);
    }
  }
}

function multiply(left: number, right: number) {
  let result = 0;
  let x = left;
  let y = right;
  while (y > 0) {
    if (y & 1) result ^= x;
    y >>>= 1;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  return result;
}

function reedSolomonDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let position = 0; position < result.length; position += 1) {
      result[position] = multiply(result[position]!, root);
      if (position + 1 < result.length) {
        result[position] ^= result[position + 1]!;
      }
    }
    root = multiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array<number>(divisor.length).fill(0);
  for (const value of data) {
    const factor = value ^ result[0]!;
    result.shift();
    result.push(0);
    for (let index = 0; index < result.length; index += 1) {
      result[index] ^= multiply(divisor[index]!, factor);
    }
  }
  return result;
}

function encodeData(text: string) {
  const bytes = [...new TextEncoder().encode(text)];
  if (bytes.length > 106) {
    throw new Error("The QR payload is too long for Homi's compact asset code.");
  }
  const buffer = new BitBuffer();
  buffer.append(0b0100, 4);
  buffer.append(bytes.length, 8);
  for (const byte of bytes) buffer.append(byte, 8);

  const capacity = dataCodewords * 8;
  buffer.append(0, Math.min(4, capacity - buffer.bits.length));
  while (buffer.bits.length % 8 !== 0) buffer.bits.push(0);

  const data: number[] = [];
  for (let offset = 0; offset < buffer.bits.length; offset += 8) {
    let value = 0;
    for (let index = 0; index < 8; index += 1) {
      value = (value << 1) | buffer.bits[offset + index]!;
    }
    data.push(value);
  }
  for (let pad = 0; data.length < dataCodewords; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }

  const divisor = reedSolomonDivisor(errorCorrectionCodewords);
  return [...data, ...reedSolomonRemainder(data, divisor)];
}

function formatBits() {
  const data = (0b01 << 3) | mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function buildMatrix(text: string): Matrix {
  const modules: Matrix = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const functions: Matrix = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y]![x] = dark;
    functions[y]![x] = true;
  };

  const drawFinder = (centerX: number, centerY: number) => {
    for (let deltaY = -4; deltaY <= 4; deltaY += 1) {
      for (let deltaX = -4; deltaX <= 4; deltaX += 1) {
        const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        setFunction(
          centerX + deltaX,
          centerY + deltaY,
          distance !== 2 && distance !== 4,
        );
      }
    }
  };

  const drawAlignment = (centerX: number, centerY: number) => {
    for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
      for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
        setFunction(
          centerX + deltaX,
          centerY + deltaY,
          Math.max(Math.abs(deltaX), Math.abs(deltaY)) !== 1,
        );
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);
  for (let index = 8; index < size - 8; index += 1) {
    setFunction(6, index, index % 2 === 0);
    setFunction(index, 6, index % 2 === 0);
  }
  drawAlignment(30, 30);

  const bits = formatBits();
  const bit = (index: number) => ((bits >>> index) & 1) !== 0;
  for (let index = 0; index <= 5; index += 1) setFunction(8, index, bit(index));
  setFunction(8, 7, bit(6));
  setFunction(8, 8, bit(7));
  setFunction(7, 8, bit(8));
  for (let index = 9; index < 15; index += 1) {
    setFunction(14 - index, 8, bit(index));
  }
  for (let index = 0; index < 8; index += 1) {
    setFunction(size - 1 - index, 8, bit(index));
  }
  for (let index = 8; index < 15; index += 1) {
    setFunction(8, size - 15 + index, bit(index));
  }
  setFunction(8, size - 8, true);

  const codewords = encodeData(text);
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    const upward = ((right + 1) & 2) === 0;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (functions[y]![x]) continue;
        let dark = false;
        if (bitIndex < codewords.length * 8) {
          const value = codewords[bitIndex >>> 3]!;
          dark = ((value >>> (7 - (bitIndex & 7))) & 1) !== 0;
        }
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y]![x] = dark;
        bitIndex += 1;
      }
    }
  }
  return modules;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createQrSvg(text: string, label = "Homi asset QR code") {
  const modules = buildMatrix(text);
  const quiet = 4;
  const viewSize = size + quiet * 2;
  const commands: string[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y]![x]) commands.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="${escapeXml(label)}" shape-rendering="crispEdges"><title>${escapeXml(label)}</title><rect width="100%" height="100%" fill="#fff"/><path d="${commands.join("")}" fill="#1d1d1f"/></svg>`;
}
