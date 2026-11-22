#!/usr/bin/env python3
"""Convert the trust's phpMyAdmin dump without executing its SQL.

Usage: python3 scripts/prepare-legacy-import.py SOURCE.sql OUTPUT.sql
The output contains private records: keep it out of version control.
Apply with psql -v ON_ERROR_STOP=1 using a verified DATABASE_URL.
"""
import argparse
import collections
import hashlib
import json
import os
import re
from pathlib import Path


def literal(value):
    if value is None:
        return 'NULL'
    if '\x00' in value:
        raise ValueError('PostgreSQL cannot preserve a NUL character in text')
    return "'" + value.replace("'", "''") + "'"


def rows_at(source, offset):
    """Decode MySQL string escapes, preserving whitespace inside strings."""
    i = offset
    escapes = {'0': '\0', 'b': '\b', 'n': '\n', 'r': '\r', 't': '\t', 'Z': '\x1a'}
    while True:
        while source[i].isspace() or source[i] == ',':
            i += 1
        if source[i] == ';':
            return
        if source[i] != '(':
            raise ValueError('Expected a value tuple')
        i += 1
        row = []
        while True:
            while source[i].isspace():
                i += 1
            if source[i] == "'":
                i += 1
                value = ''
                while True:
                    c = source[i]
                    i += 1
                    if c == '\\':
                        c = source[i]
                        i += 1
                        value += escapes.get(c, c)
                    elif c == "'":
                        if source[i] == "'":
                            value += "'"
                            i += 1
                        else:
                            break
                    else:
                        value += c
            else:
                start = i
                while source[i] not in ',)':
                    i += 1
                value = source[start:i].strip()
                if value.upper() == 'NULL':
                    value = None
                elif not re.fullmatch(r'-?\d+(?:\.\d+)?', value):
                    raise ValueError('Unexpected unquoted SQL value')
            row.append(value)
            while source[i].isspace():
                i += 1
            delimiter = source[i]
            i += 1
            if delimiter == ')':
                yield row
                break
            if delimiter != ',':
                raise ValueError('Expected a value separator')


def convert(source, schema_only=False):
    tables = collections.OrderedDict()
    data = collections.defaultdict(list)
    for match in re.finditer(r'CREATE TABLE `([\w]+)` \((.*?)\) ENGINE', source, re.S):
        name, body = match.groups()
        columns = []
        for line in body.strip().splitlines():
            field = re.fullmatch(r'\s*`(\w+)` (.*?),?\s*', line)
            if not field:
                raise ValueError('Unsupported schema line')
            column, definition = field.groups()
            definition = definition.rstrip(',')
            enum = re.match(r"enum\((.*?)\)", definition)
            if enum:
                pg_type = 'text'
                check = f' CHECK ("{column}" IN ({enum[1]}))'
            else:
                mysql_type = definition.split()[0]
                if mysql_type.startswith(('char(', 'varchar(')):
                    pg_type = mysql_type
                elif mysql_type.startswith('bigint('):
                    pg_type = 'bigint'
                elif mysql_type.startswith(('int(', 'tinyint(')):
                    pg_type = 'integer'
                else:
                    pg_type = {'text': 'text', 'longtext': 'text', 'date': 'date',
                               'timestamp': 'timestamp without time zone'}.get(mysql_type)
                if not pg_type:
                    raise ValueError('Unsupported source type: ' + mysql_type)
                check = ''
            nullability = ' NOT NULL' if 'NOT NULL' in definition else ''
            default = re.search(r"DEFAULT (NULL|'(?:[^']|'')*'|current_timestamp\(\)|\d+)", definition)
            default_sql = ' DEFAULT ' + default[1].replace('current_timestamp()', 'CURRENT_TIMESTAMP') if default else ''
            columns.append((column, f'"{column}" {pg_type}{nullability}{default_sql}{check}'))
        tables[name] = columns
    for match in re.finditer(r'INSERT INTO `(\w+)` \(([^\n]+)\) VALUES\s*', source):
        name = match[1]
        columns = re.findall(r'`(\w+)`', match[2])
        if columns != [c[0] for c in tables[name]]:
            raise ValueError('Unexpected insert column order')
        for row in rows_at(source, match.end()):
            if len(row) != len(columns):
                raise ValueError('Incorrect number of values')
            data[name].append(row)
    out = ['BEGIN;', 'SET LOCAL standard_conforming_strings = on;',
           "SET LOCAL TIME ZONE 'UTC';", 'CREATE SCHEMA legacy_trust;',
           'REVOKE ALL ON SCHEMA legacy_trust FROM PUBLIC, anon, authenticated;',
           'GRANT USAGE ON SCHEMA legacy_trust TO service_role;']
    for name, columns in tables.items():
        out.append(f'CREATE TABLE legacy_trust."{name}" (\n' + ',\n'.join(c[1] for c in columns) + '\n);')
        out.append(f'ALTER TABLE legacy_trust."{name}" ENABLE ROW LEVEL SECURITY;')
        out.append(f'REVOKE ALL ON legacy_trust."{name}" FROM PUBLIC, anon, authenticated;')
        out.append(f'GRANT ALL ON legacy_trust."{name}" TO service_role;')
        for start in range(0, 0 if schema_only else len(data[name]), 250):
            batch = data[name][start:start + 250]
            out.append(f'INSERT INTO legacy_trust."{name}" VALUES\n' + ',\n'.join(
                '(' + ','.join(literal(v) for v in row) + ')' for row in batch) + ';')
    for match in re.finditer(r'ALTER TABLE `(\w+)`(.*?);', source, re.S):
        name, alterations = match.groups()
        primary = re.search(r'ADD PRIMARY KEY \(([^)]+)\)', alterations)
        if primary:
            fields = primary[1].replace('`', '"')
            out.append(f'ALTER TABLE legacy_trust."{name}" ADD PRIMARY KEY ({fields});')
        for index in re.finditer(r'ADD (UNIQUE )?KEY `(\w+)` \(([^)]+)\)', alterations):
            unique, index_name, fields = index.groups()
            fields = fields.replace('`', '"')
            out.append(f'CREATE {unique or ""}INDEX "{index_name}" ON legacy_trust."{name}" ({fields});')
        for fk in re.finditer(r'ADD CONSTRAINT `(\w+)` FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)` \(`(\w+)`\) ON DELETE SET NULL', alterations):
            constraint, field, target, target_field = fk.groups()
            out.append(f'ALTER TABLE legacy_trust."{name}" ADD CONSTRAINT "{constraint}" FOREIGN KEY ("{field}") REFERENCES legacy_trust."{target}" ("{target_field}") ON DELETE SET NULL;')
        if 'AUTO_INCREMENT' in alterations:
            out.append(f'ALTER TABLE legacy_trust."{name}" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY;')
            if not schema_only:
                out.append(f"SELECT setval(pg_get_serial_sequence('legacy_trust.{name}', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM legacy_trust.\"{name}\";")
    # Intentional owner-executed, read-only projections: no donor/contact columns.
    # Never replace existing application views on a database we have not provisioned.
    out.extend([
        'CREATE VIEW public.catalogue AS SELECT id, "bookName" AS title, author, class AS class_name, utbn FROM legacy_trust.book_lists WHERE status = \'active\';',
        'CREATE VIEW public.catalogue_classes AS SELECT DISTINCT class_name FROM public.catalogue;',
        'REVOKE ALL ON public.catalogue, public.catalogue_classes FROM PUBLIC, anon, authenticated;',
        'GRANT SELECT ON public.catalogue, public.catalogue_classes TO anon, authenticated, service_role;',
    ])
    if not schema_only:
        for name in tables:
            out.append(f'DO $$ BEGIN IF (SELECT count(*) FROM legacy_trust."{name}") <> {len(data[name])} THEN RAISE EXCEPTION \'Import count mismatch: {name}\'; END IF; END $$;')
    out.extend(["NOTIFY pgrst, 'reload schema';", 'COMMIT;'])
    return '\n'.join(out) + '\n', {name: len(data[name]) for name in tables}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--schema-only', action='store_true', help='Generate a migration without private records or data-count assertions')
    args = parser.parse_args()
    source_bytes = args.source.read_bytes()
    sql, counts = convert(source_bytes.decode('utf-8'), schema_only=args.schema_only)
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as target:
        target.write(sql)
    print(json.dumps({'source_sha256': hashlib.sha256(source_bytes).hexdigest(),
                      'tables': counts, 'total_rows': sum(counts.values())}, indent=2))
