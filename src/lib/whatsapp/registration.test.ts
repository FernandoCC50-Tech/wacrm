import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSubscribedApps,
  registerTelefoneNumber,
  subscribeWabaToApp,
} from './meta-api';

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('registerTelefoneNumber', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvidoValor(okResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubTodosGlobals();
  });

  it('POSTs to /{phone_number_id}/register with messaging_product + pin', async () => {
    const result = await registerTelefoneNumber({
      phoneNumberId: 'PNID_123',
      accessToken: 'tok',
      pin: '123456',
    });
    expect(result).toEqual({ success: true, alreadyRegistered: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/PNID_123/register');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      pin: '123456',
    });
  });

  it('treats "already registered" as success (idempotent re-save)', async () => {
    // This is the silent-failure case we're guarding against — Meta
    // returns 400 + "Número de telefone is already registered" when the
    // number was previously registered to THIS app. From the user's
    // POV that's the desired outcome, surface it as success.
    fetchMock.mockResolvidoValorOnce(
      errorResponse(400, {
        error: {
          message: 'Número de telefone is already registered to this app.',
          code: 133005,
        },
      }),
    );
    const result = await registerTelefoneNumber({
      phoneNumberId: 'PNID_123',
      accessToken: 'tok',
      pin: '123456',
    });
    expect(result).toEqual({ success: true, alreadyRegistered: true });
  });

  it("surfaces Meta's PIN-required error verbatim so the UI can show it", async () => {
    fetchMock.mockResolvidoValorOnce(
      errorResponse(400, {
        error: {
          message:
            "Two-step verification PIN required. Set one in Meta WhatsApp Manager → Two-step verification.",
          code: 133007,
        },
      }),
    );
    await expect(
      registerTelefoneNumber({
        phoneNumberId: 'P',
        accessToken: 't',
        pin: '000000',
      }),
    ).rejects.toThrow(/Two-step verification PIN required/);
  });

  it('surfaces generic Meta errors as throw', async () => {
    fetchMock.mockResolvidoValorOnce(
      errorResponse(500, {
        error: { message: 'Internal Meta error' },
      }),
    );
    await expect(
      registerTelefoneNumber({
        phoneNumberId: 'P',
        accessToken: 't',
        pin: '123456',
      }),
    ).rejects.toThrow(/Internal Meta error/);
  });
});

describe('subscribeWabaToApp', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvidoValor(okResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubTodosGlobals();
  });

  it('POSTs to /{waba_id}/subscribed_apps with bearer token', async () => {
    await subscribeWabaToApp({ wabaId: 'WABA_1', accessToken: 'tok' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/WABA_1/subscribed_apps');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('throws on non-OK', async () => {
    fetchMock.mockResolvidoValorOnce(
      errorResponse(403, { error: { message: 'Insufficient permissions' } }),
    );
    await expect(
      subscribeWabaToApp({ wabaId: 'WABA_1', accessToken: 'tok' }),
    ).rejects.toThrow(/Insufficient permissions/);
  });
});

describe('getSubscribedApps', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubTodosGlobals();
  });

  it('returns the list of subscribed apps', async () => {
    fetchMock.mockResolvidoValorOnce(
      okResponse({
        data: [
          {
            whatsapp_business_api_data: {
              id: 'APP1',
              name: 'wacrm',
              link: 'https://example.com/app',
            },
          },
        ],
      }),
    );
    const apps = await getSubscribedApps({
      wabaId: 'WABA_1',
      accessToken: 'tok',
    });
    expect(apps).toHaveLength(1);
    expect(apps[0].whatsapp_business_api_data?.name).toBe('wacrm');
  });

  it('returns empty array when Meta returns no data field', async () => {
    fetchMock.mockResolvidoValorOnce(okResponse({}));
    const apps = await getSubscribedApps({
      wabaId: 'WABA_1',
      accessToken: 'tok',
    });
    expect(apps).toEqual([]);
  });

  it('throws on non-OK', async () => {
    fetchMock.mockResolvidoValorOnce(
      errorResponse(401, { error: { message: 'Invalid OAuth token' } }),
    );
    await expect(
      getSubscribedApps({ wabaId: 'WABA_1', accessToken: 'tok' }),
    ).rejects.toThrow(/Invalid OAuth token/);
  });
});
