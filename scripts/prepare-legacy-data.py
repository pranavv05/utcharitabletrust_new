#!/usr/bin/env python3
"""Create a private data-only migration for an EMPTY, baseline-provisioned database.

Usage: python3 scripts/prepare-legacy-data.py SOURCE.sql OUTPUT.private.sql
Never apply the output to an already populated database or publish its records.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
from collections import defaultdict
from pathlib import Path


def prepare(source):
    spec = importlib.util.spec_from_file_location(
        'legacy_parser', Path(__file__).with_name('prepare-legacy-import.py'))
    parser = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parser)
    # Validate schema, insert columns, values and row widths with the full converter.
    _, counts = parser.convert(source)
    columns = {}
    for match in re.finditer(r'CREATE TABLE `(\w+)` \((.*?)\) ENGINE', source, re.S):
        columns[match[1]] = re.findall(r'^\s*`(\w+)`', match[2], re.M)
    rows = defaultdict(list)
    for match in re.finditer(r'INSERT INTO `(\w+)` \(([^\n]+)\) VALUES\s*', source):
        rows[match[1]].extend(parser.rows_at(source, match.end()))
    dependencies = defaultdict(set)
    for match in re.finditer(r'ALTER TABLE `(\w+)`(.*?);', source, re.S):
        dependencies[match[1]].update(re.findall(r'REFERENCES `(\w+)`', match[2]))
    order, visiting, done = [], set(), set()

    def visit(table):
        if table in done:
            return
        if table in visiting:
            raise ValueError('Cyclic foreign keys require a reviewed import strategy')
        if table not in columns:
            raise ValueError('Unknown foreign-key target')
        visiting.add(table)
        for parent in sorted(dependencies[table]):
            visit(parent)
        visiting.remove(table)
        done.add(table)
        order.append(table)

    for table in columns:
        visit(table)
    if not order:
        raise ValueError('No source tables found')
    out = [
        '-- PRIVATE DATA: personal records and historical authentication material.',
        '-- Apply only AFTER the baseline to a fresh, EMPTY database.',
        '-- The current Supabase project is already populated: DO NOT APPLY THERE.',
        '-- Do not commit or upload this file to GitHub.',
        '-- Source SHA-256: ' + hashlib.sha256(source.encode('utf-8')).hexdigest(),
        'BEGIN;', 'SET LOCAL standard_conforming_strings = on;',
        "SET LOCAL TIME ZONE 'UTC';",
        # Lock against concurrent writes before checking whether the target is empty.
        'LOCK TABLE ' + ', '.join(f'legacy_trust."{t}"' for t in order)
        + ' IN SHARE ROW EXCLUSIVE MODE;',
    ]
    for table in order:
        out.append(f'DO $$ BEGIN IF EXISTS (SELECT 1 FROM legacy_trust."{table}") '
                   f"THEN RAISE EXCEPTION 'Target must be empty: {table}; import refused'; END IF; END $$;")
    for table in order:
        if len(rows[table]) != counts[table]:
            raise ValueError('Source count mismatch: ' + table)
        names = ', '.join(f'"{c}"' for c in columns[table])
        for start in range(0, len(rows[table]), 250):
            batch = rows[table][start:start + 250]
            out.append(f'INSERT INTO legacy_trust."{table}" ({names}) VALUES\n'
                       + ',\n'.join('(' + ','.join(parser.literal(v) for v in row)
                                    + ')' for row in batch) + ';')
    for table in order:
        out.append(f'DO $$ BEGIN IF (SELECT count(*) FROM legacy_trust."{table}") <> {counts[table]} '
                   f"THEN RAISE EXCEPTION 'Import count mismatch: {table}'; END IF; END $$;")
    for match in re.finditer(r'ALTER TABLE `(\w+)`(.*?);', source, re.S):
        if 'AUTO_INCREMENT' in match[2]:
            table = match[1]
            out.append(f"SELECT setval(pg_get_serial_sequence('legacy_trust.{table}', 'id'), "
                       f'COALESCE(MAX(id), 1), COUNT(*) > 0) FROM legacy_trust."{table}";')
    out.extend(["NOTIFY pgrst, 'reload schema';", 'COMMIT;'])
    return '\n'.join(out) + '\n', counts


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('source', type=Path)
    cli.add_argument('output', type=Path)
    args = cli.parse_args()
    if not args.output.name.endswith('.private.sql'):
        cli.error('Output must end in .private.sql to stay excluded from Git')
    sql, counts = prepare(args.source.read_bytes().decode('utf-8'))
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as target:
        target.write(sql)
    print(json.dumps({'tables': counts, 'total_rows': sum(counts.values()),
                      'output': str(args.output)}, indent=2))
