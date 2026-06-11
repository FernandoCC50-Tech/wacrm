import { describe, expect, it } from 'vitest';
import { buildEnviarComponents } from './template-send-builder';
import type { MessageModelo } from '@/types';

function row(overrides: Partial<MessageModelo> = {}): MessageModelo {
  return {
    id: 'row-1',
    user_id: 'user-1',
    name: 'order_confirmation',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Your order is on its way.',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildEnviarComponents — body', () => {
  it('returns [] for a fully-static template (no vars, no media header)', () => {
    expect(buildEnviarComponents(row())).toEqual([]);
  });

  it('emits a body component when the template has variables', () => {
    const components = buildEnviarComponents(
      row({ body_text: 'Hi {{1}}, order {{2}} confirmed.' }),
      { body: ['John', 'ORD-42'] },
    );
    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'John' },
          { type: 'text', text: 'ORD-42' },
        ],
      },
    ]);
  });

  it('throws when body has variables but caller supplied too few values', () => {
    expect(() =>
      buildEnviarComponents(
        row({ body_text: 'Hi {{1}} {{2}}' }),
        { body: ['just one'] },
      ),
    ).toThrow(/2 variable\(s\) but only 1/);
  });

  it('trims extra body values silently (legacy callers may overshoot)', () => {
    const components = buildEnviarComponents(
      row({ body_text: 'Hi {{1}}' }),
      { body: ['John', 'extra', 'extra2'] },
    );
    expect(components).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'John' }] },
    ]);
  });
});

describe('buildEnviarComponents — header', () => {
  it('skips static TEXT headers (template carries them)', () => {
    expect(
      buildEnviarComponents(
        row({ header_type: 'text', header_content: 'Order Confirmaration' }),
      ),
    ).toEqual([]);
  });

  it('emits a TEXT header component when {{1}} is present', () => {
    const components = buildEnviarComponents(
      row({ header_type: 'text', header_content: 'Hello {{1}}' }),
      { headerText: 'Sara' },
    );
    expect(components).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Sara' }] },
    ]);
  });

  it('throws when TEXT header has {{1}} but no value was supplied', () => {
    expect(() =>
      buildEnviarComponents(
        row({ header_type: 'text', header_content: 'Hello {{1}}' }),
      ),
    ).toThrow(/Header text variable \{\{1\}\}/);
  });

  it('auto-includes IMAGE header from the stored sample URL', () => {
    const components = buildEnviarComponents(
      row({
        header_type: 'image',
        header_media_url: 'https://example.com/sample.jpg',
      }),
    );
    expect(components).toEqual([
      {
        type: 'header',
        parameters: [
          { type: 'image', image: { link: 'https://example.com/sample.jpg' } },
        ],
      },
    ]);
  });

  it('prefers caller override URL over template sample', () => {
    const components = buildEnviarComponents(
      row({
        header_type: 'video',
        header_media_url: 'https://example.com/default.mp4',
      }),
      { headerMediaUrl: 'https://example.com/custom.mp4' },
    );
    expect(components[0]).toEqual({
      type: 'header',
      parameters: [
        { type: 'video', video: { link: 'https://example.com/custom.mp4' } },
      ],
    });
  });

  it('prefers media id over url when both are available', () => {
    const components = buildEnviarComponents(
      row({
        header_type: 'document',
        header_handle: '4::aBc',
        header_media_url: 'https://x.com/doc.pdf',
      }),
    );
    expect(components[0]).toEqual({
      type: 'header',
      parameters: [{ type: 'document', document: { id: '4::aBc' } }],
    });
  });

  it('throws on media header with no link OR id available', () => {
    expect(() =>
      buildEnviarComponents(row({ header_type: 'image' })),
    ).toThrow(/requires a media link or id/);
  });
});

describe('buildEnviarComponents — buttons', () => {
  it('omits URL buttons without variables (template carries the URL)', () => {
    const components = buildEnviarComponents(
      row({
        buttons: [
          { type: 'URL', text: 'Visit', url: 'https://example.com' },
        ],
      }),
    );
    expect(components).toEqual([]);
  });

  it('emits a URL button component when the URL has {{1}}', () => {
    const components = buildEnviarComponents(
      row({
        buttons: [
          { type: 'URL', text: 'Track', url: 'https://x.com/{{1}}' },
        ],
      }),
      { buttonParams: { 0: 'ORD-42' } },
    );
    expect(components).toEqual([
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: 'ORD-42' }],
      },
    ]);
  });

  it('throws when URL button has {{1}} but no buttonParam was provided', () => {
    expect(() =>
      buildEnviarComponents(
        row({
          buttons: [
            { type: 'URL', text: 'Track', url: 'https://x.com/{{1}}' },
          ],
        }),
      ),
    ).toThrow(/URL button #1 uses \{\{1\}\}/);
  });

  it('uses the correct index when QR buttons precede the URL button', () => {
    // sub_type:url at index "2" because two QUICK_REPLY buttons came first.
    const components = buildEnviarComponents(
      row({
        buttons: [
          { type: 'QUICK_REPLY', text: 'Yes' },
          { type: 'QUICK_REPLY', text: 'No' },
          { type: 'URL', text: 'Aberto', url: 'https://x.com/{{1}}' },
        ],
      }),
      { buttonParams: { 2: 'ORD-42' } },
    );
    const urlBtn = components.find((c) => c.type === 'button');
    expect(urlBtn).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '2',
      parameters: [{ type: 'text', text: 'ORD-42' }],
    });
  });

  it('falls back to the template example for COPY_CODE buttons', () => {
    const components = buildEnviarComponents(
      row({
        buttons: [
          { type: 'COPY_CODE', text: 'Copiar', example: 'SUMMER20' },
        ],
      }),
    );
    expect(components).toEqual([
      {
        type: 'button',
        sub_type: 'copy_code',
        index: '0',
        parameters: [{ type: 'coupon_code', coupon_code: 'SUMMER20' }],
      },
    ]);
  });

  it('overrides COPY_CODE code when caller supplies one', () => {
    const components = buildEnviarComponents(
      row({
        buttons: [{ type: 'COPY_CODE', text: 'Copiar', example: 'STATIC' }],
      }),
      { buttonParams: { 0: 'PERSONAL_CODE' } },
    );
    expect((components[0] as { parameters: { coupon_code: string }[] })
      .parameters[0].coupon_code).toBe('PERSONAL_CODE');
  });

  it('skips PHONE_NUMBER buttons entirely (no send-time params allowed)', () => {
    const components = buildEnviarComponents(
      row({
        buttons: [
          { type: 'PHONE_NUMBER', text: 'Call', phone_number: '+15551234567' },
        ],
      }),
    );
    expect(components).toEqual([]);
  });
});

describe('buildEnviarComponents — end-to-end mix', () => {
  it('orders components header → body → buttons and includes all', () => {
    const components = buildEnviarComponents(
      row({
        header_type: 'image',
        header_media_url: 'https://x.com/img.jpg',
        body_text: 'Hi {{1}}',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Yes' },
          { type: 'URL', text: 'Track', url: 'https://x.com/{{1}}' },
        ],
      }),
      { body: ['John'], buttonParams: { 1: 'abc' } },
    );
    expect(components.map((c) => c.type)).toEqual(['header', 'body', 'button']);
    // QUICK_REPLY at index 0 doesn't need send-time params, so only the
    // URL button at index 1 emits a component.
    expect((components[2] as { index: string }).index).toBe('1');
  });
});
