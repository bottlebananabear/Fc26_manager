import { readFile } from "node:fs/promises";
import type {
  DecodedRecord,
  DecodedScalar,
  FieldDefinition,
  ParsedSave,
  TableDefinition,
} from "../types.js";

const DB_SIGNATURE = Buffer.from([0x44, 0x42, 0x00, 0x08, 0, 0, 0, 0]);
const FIELD_TYPE_STRING = 0;
const FIELD_TYPE_INT = 3;
const FIELD_TYPE_FLOAT = 4;

function u16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function u32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function findSignatures(buffer: Buffer): number[] {
  const offsets: number[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const found = buffer.indexOf(DB_SIGNATURE, cursor);
    if (found < 0) break;
    offsets.push(found);
    cursor = found + DB_SIGNATURE.length;
  }

  return offsets;
}

function parseField(buffer: Buffer, offset: number, index: number): FieldDefinition {
  return {
    index,
    type: u32(buffer, offset),
    bitOffset: u32(buffer, offset + 4),
    shortName: buffer.subarray(offset + 8, offset + 12).toString("latin1"),
    bitDepth: u32(buffer, offset + 12),
  };
}

function parseTable(
  buffer: Buffer,
  databaseIndex: number,
  index: number,
  shortName: string,
  directoryOffset: number,
  headerOffset: number,
): TableDefinition | null {
  if (headerOffset + 36 > buffer.length) return null;

  const recordSize = u32(buffer, headerOffset + 4);
  const validRecords = u16(buffer, headerOffset + 18);
  const fieldsCount = buffer[headerOffset + 24] ?? 0;
  const fieldsStart = headerOffset + 36;
  const recordsStart = fieldsStart + fieldsCount * 16;

  if (
    recordSize <= 0 ||
    recordSize > 100_000 ||
    fieldsCount <= 0 ||
    fieldsCount > 4_096 ||
    recordsStart + recordSize * validRecords > buffer.length
  ) {
    return null;
  }

  const fields: FieldDefinition[] = [];
  for (let fieldIndex = 0; fieldIndex < fieldsCount; fieldIndex += 1) {
    fields.push(parseField(buffer, fieldsStart + fieldIndex * 16, fieldIndex));
  }

  return {
    databaseIndex,
    index,
    shortName,
    directoryOffset,
    headerOffset,
    recordSize,
    validRecords,
    fieldsCount,
    recordsStart,
    fields,
  };
}

export async function parseSave(filePath: string): Promise<ParsedSave> {
  const buffer = await readFile(filePath);
  const tables = new Map<string, TableDefinition[]>();

  for (const [databaseIndex, databaseOffset] of findSignatures(buffer).entries()) {
    const tableCount = u32(buffer, databaseOffset + 16);
    const directoryStart = databaseOffset + 24;
    const tablesStart = directoryStart + tableCount * 8 + 4;

    for (let tableIndex = 0; tableIndex < tableCount; tableIndex += 1) {
      const directoryOffset = directoryStart + tableIndex * 8;
      const shortName = buffer.subarray(directoryOffset, directoryOffset + 4).toString("latin1");
      const relativeHeaderOffset = u32(buffer, directoryOffset + 4);
      const headerOffset = tablesStart + relativeHeaderOffset;
      const table = parseTable(
        buffer,
        databaseIndex,
        tableIndex,
        shortName,
        directoryOffset,
        headerOffset,
      );

      if (!table) continue;
      const existing = tables.get(shortName) ?? [];
      existing.push(table);
      tables.set(shortName, existing);
    }
  }

  return { filePath, buffer, tables };
}

function readInteger(record: Buffer, bitOffset: number, bitDepth: number): DecodedScalar {
  if (bitDepth <= 0) return 0;

  const byteStart = bitOffset >> 3;
  const bitInByte = bitOffset & 7;
  const byteCount = Math.ceil((bitInByte + bitDepth) / 8);
  let chunk = 0n;

  for (let index = 0; index < byteCount; index += 1) {
    chunk |= BigInt(record[byteStart + index] ?? 0) << BigInt(index * 8);
  }

  const mask = (1n << BigInt(bitDepth)) - 1n;
  const value = (chunk >> BigInt(bitInByte)) & mask;

  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}

function readString(record: Buffer, bitOffset: number, bitDepth: number): string {
  const start = bitOffset >> 3;
  const length = bitDepth >> 3;
  const raw = record.subarray(start, start + length);
  const zero = raw.indexOf(0);
  return raw.subarray(0, zero >= 0 ? zero : undefined).toString("utf8").trim();
}

function decodeRecord(record: Buffer, fields: FieldDefinition[]): DecodedRecord {
  const result: DecodedRecord = {};

  for (const field of fields) {
    const duplicate = Object.hasOwn(result, field.shortName);
    const key = duplicate ? `${field.shortName}_${field.index}` : field.shortName;

    if (field.type === FIELD_TYPE_STRING) {
      result[key] = readString(record, field.bitOffset, field.bitDepth);
    } else if (field.type === FIELD_TYPE_INT) {
      result[key] = readInteger(record, field.bitOffset, field.bitDepth);
    } else if (field.type === FIELD_TYPE_FLOAT) {
      const start = field.bitOffset >> 3;
      result[key] = record.readFloatLE(start);
    } else {
      result[key] = null;
    }
  }

  return result;
}

export function selectTable(save: ParsedSave, shortName: string): TableDefinition {
  const candidates = save.tables.get(shortName);
  if (!candidates?.length) {
    throw new Error(`Table ${shortName} was not found in ${save.filePath}`);
  }

  return [...candidates].sort((left, right) => right.validRecords - left.validRecords)[0]!;
}

export function decodeTable(save: ParsedSave, shortName: string): DecodedRecord[] {
  const table = selectTable(save, shortName);
  const rows: DecodedRecord[] = [];

  for (let index = 0; index < table.validRecords; index += 1) {
    const start = table.recordsStart + index * table.recordSize;
    const record = save.buffer.subarray(start, start + table.recordSize);
    rows.push(decodeRecord(record, table.fields));
  }

  return rows;
}
