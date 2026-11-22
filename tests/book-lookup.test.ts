import test from 'node:test';
import assert from 'node:assert/strict';
import {extractIsbn, normalizeIsbn} from '../src/lib/admin/isbn';
import {lookupIsbn, parseCoverReading, readCover, validateImageDataUrl} from '../src/lib/admin/book-lookup';

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), {status})) as unknown as typeof fetch;

test('ISBNs are validated by checksum, with or without hyphens and prefixes', () => {
  assert.equal(normalizeIsbn('978-0-306-40615-7'), '9780306406157');
  assert.equal(normalizeIsbn('ISBN 0-306-40615-2'), '0306406152');
  assert.equal(normalizeIsbn('9780306406158'), null);
  assert.equal(normalizeIsbn('123'), null);
  assert.equal(normalizeIsbn('080442957X'), '080442957X');
});

test('extractIsbn finds an ISBN inside text and ignores other numbers', () => {
  assert.equal(extractIsbn('Price 250  ISBN 978-0-306-40615-7  Printed in India'), '9780306406157');
  assert.equal(extractIsbn('Phone 9377958582'), null);
});

test('lookup uses Open Library first and tidies the result', async () => {
  const fetchImpl = json({
    'ISBN:9780306406157': {
      title: '  Atlas   of the World ',
      authors: [{name: 'A. Writer'}, {name: 'B. Editor'}],
      subjects: [{name: 'Geography'}],
    },
  });
  const book = await lookupIsbn('978-0-306-40615-7', fetchImpl);
  assert.deepEqual(
    {t: book?.title, a: book?.author, i: book?.isbn, s: book?.source, c: book?.categories},
    {t: 'Atlas of the World', a: 'A. Writer, B. Editor', i: '9780306406157', s: 'barcode', c: ['Geography']},
  );
});

test('lookup falls back to Google Books and returns null for unknown or invalid ISBNs', async () => {
  let calls = 0;
  const fetchImpl = (async (url: string) => {
    calls += 1;
    return url.includes('openlibrary')
      ? new Response('{}')
      : new Response(
          JSON.stringify({items: [{volumeInfo: {title: 'Maths', subtitle: 'Class 9', authors: ['R. Rao']}}]}),
        );
  }) as unknown as typeof fetch;
  const book = await lookupIsbn('9780306406157', fetchImpl);
  assert.equal(book?.title, 'Maths: Class 9');
  assert.equal(calls, 2);
  assert.equal(await lookupIsbn('9780306406157', json({}, 200)), null);
  assert.equal(await lookupIsbn('not an isbn', json({})), null);
});

test('lookup survives network failures', async () => {
  const down = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.equal(await lookupIsbn('9780306406157', down), null);
});

test('cover readings are validated and trimmed', () => {
  const book = parseCoverReading(
    'Sure! {"title":"  Science  Class 8 ","author":"NCERT","class_name":"Class 8","isbn":"9780306406157"}',
  );
  assert.equal(book?.title, 'Science Class 8');
  assert.equal(book?.class_name, 'Class 8');
  assert.equal(book?.isbn, '9780306406157');
  assert.equal(book?.source, 'cover');
  assert.equal(parseCoverReading('{"title":""}'), null);
  assert.equal(parseCoverReading('not json'), null);
  assert.equal(parseCoverReading('{"title":"X","isbn":"123"}')?.isbn, undefined);
});

test('the vision call sends the key and image, and treats errors as failures', async () => {
  let seen: {auth: string | null; body: {model: string; messages: {content: {type: string}[]}[]}} | null =
    null;
  const ok = (async (_url: string, init: RequestInit) => {
    seen = {auth: new Headers(init.headers).get('authorization'), body: JSON.parse(String(init.body))};
    return new Response(
      JSON.stringify({choices: [{message: {content: '{"title":"Atlas","author":"","class_name":""}'}}]}),
    );
  }) as unknown as typeof fetch;
  const book = await readCover('data:image/jpeg;base64,/9j/4AAQ', {apiKey: 'k', model: 'm', fetchImpl: ok});
  assert.equal(book?.title, 'Atlas');
  assert.equal(seen!.auth, 'Bearer k');
  assert.equal(seen!.body.model, 'm');
  assert.deepEqual(
    seen!.body.messages[0].content.map((c) => c.type),
    ['text', 'image_url'],
  );
  await assert.rejects(() =>
    readCover('data:image/jpeg;base64,/9j/4AAQ', {apiKey: 'k', model: 'm', fetchImpl: json({}, 500)}),
  );
});

test('only real JPEG, PNG and WebP data URLs are accepted', () => {
  const jpeg =
    'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString('base64');
  const png =
    'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).toString('base64');
  assert.equal(validateImageDataUrl(jpeg).ok, true);
  assert.equal(validateImageDataUrl(png).ok, true);
  assert.equal(
    validateImageDataUrl('data:image/png;base64,' + Buffer.from('<html>script').toString('base64')).ok,
    false,
  );
  assert.equal(validateImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=').ok, false);
  assert.equal(validateImageDataUrl('https://example.com/a.jpg').ok, false);
  assert.equal(validateImageDataUrl(42).ok, false);
});
