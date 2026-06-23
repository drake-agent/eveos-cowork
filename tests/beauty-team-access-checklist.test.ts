import { describe, expect, it } from 'vitest';
import { buildBeautyTeamAccessChecklist } from '../src/renderer/components/beauty/beauty-team-access-checklist';

describe('buildBeautyTeamAccessChecklist', () => {
  it('marks gateway, token storage, and Anna isolation readiness separately from Cloudflare admin work', () => {
    const checklist = buildBeautyTeamAccessChecklist({
      baseUrl: 'https://beauty.eveos.one',
      hasToken: true,
      healthStatus: 'ready',
    });

    expect(checklist.counts).toEqual({
      ready: 3,
      verify: 0,
      needsAdmin: 1,
      needsUser: 0,
    });
    expect(checklist.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gateway',
          label: 'Beauty API gateway',
          status: 'ready',
          detail: 'https://beauty.eveos.one is reachable from this client.',
        }),
        expect.objectContaining({
          id: 'cloudflare-access',
          label: 'Cloudflare Access allowlist',
          status: 'needs_admin',
          owner: 'Admin',
        }),
        expect.objectContaining({
          id: 'token',
          label: 'Beauty API token',
          status: 'ready',
          detail: 'Bearer token is saved in Electron main process storage.',
        }),
        expect.objectContaining({
          id: 'anna-isolation',
          label: 'Anna isolation',
          status: 'ready',
        }),
      ])
    );
  });

  it('calls out unsafe or incomplete enrollment states for the current user', () => {
    const checklist = buildBeautyTeamAccessChecklist({
      baseUrl: 'http://localhost:8787',
      hasToken: false,
      healthStatus: 'error',
    });

    expect(checklist.counts).toEqual({
      ready: 1,
      verify: 0,
      needsAdmin: 2,
      needsUser: 1,
    });
    expect(checklist.items.find((item) => item.id === 'gateway')).toMatchObject({
      status: 'needs_admin',
      detail: 'Use https://beauty.eveos.one for team access, then run Health.',
    });
    expect(checklist.items.find((item) => item.id === 'token')).toMatchObject({
      status: 'needs_user',
      owner: 'Team member',
    });
  });
});
