export type BeautyTeamAccessStatus = 'ready' | 'verify' | 'needs_admin' | 'needs_user';

export interface BeautyTeamAccessChecklistInput {
  baseUrl: string;
  hasToken: boolean;
  healthStatus: 'idle' | 'loading' | 'ready' | 'error';
}

export interface BeautyTeamAccessChecklistItem {
  id: string;
  label: string;
  status: BeautyTeamAccessStatus;
  owner: 'Admin' | 'Team member' | 'App';
  detail: string;
}

export interface BeautyTeamAccessChecklist {
  items: BeautyTeamAccessChecklistItem[];
  counts: {
    ready: number;
    verify: number;
    needsAdmin: number;
    needsUser: number;
  };
}

const TEAM_BASE_URL = 'https://beauty.eveos.one';

export function buildBeautyTeamAccessChecklist(
  input: BeautyTeamAccessChecklistInput
): BeautyTeamAccessChecklist {
  const items: BeautyTeamAccessChecklistItem[] = [
    buildGatewayItem(input.baseUrl, input.healthStatus),
    {
      id: 'cloudflare-access',
      label: 'Cloudflare Access allowlist',
      status: 'needs_admin',
      owner: 'Admin',
      detail: 'Add teammate emails to the Cloudflare Access policy for beauty.eveos.one.',
    },
    {
      id: 'token',
      label: 'Beauty API token',
      status: input.hasToken ? 'ready' : 'needs_user',
      owner: 'Team member',
      detail: input.hasToken
        ? 'Bearer token is saved in Electron main process storage.'
        : 'Paste the Beauty API token once; renderer only sees hasToken.',
    },
    {
      id: 'anna-isolation',
      label: 'Anna isolation',
      status: 'ready',
      owner: 'App',
      detail: 'Team use goes through the Beauty API. No Anna files, DB, SSH, or Tailscale access.',
    },
  ];

  return {
    items,
    counts: {
      ready: items.filter((item) => item.status === 'ready').length,
      verify: items.filter((item) => item.status === 'verify').length,
      needsAdmin: items.filter((item) => item.status === 'needs_admin').length,
      needsUser: items.filter((item) => item.status === 'needs_user').length,
    },
  };
}

function buildGatewayItem(
  baseUrl: string,
  healthStatus: BeautyTeamAccessChecklistInput['healthStatus']
): BeautyTeamAccessChecklistItem {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  if (normalizedBaseUrl !== TEAM_BASE_URL) {
    return {
      id: 'gateway',
      label: 'Beauty API gateway',
      status: 'needs_admin',
      owner: 'Admin',
      detail: `Use ${TEAM_BASE_URL} for team access, then run Health.`,
    };
  }

  if (healthStatus === 'ready') {
    return {
      id: 'gateway',
      label: 'Beauty API gateway',
      status: 'ready',
      owner: 'App',
      detail: `${TEAM_BASE_URL} is reachable from this client.`,
    };
  }

  if (healthStatus === 'error') {
    return {
      id: 'gateway',
      label: 'Beauty API gateway',
      status: 'needs_admin',
      owner: 'Admin',
      detail: `${TEAM_BASE_URL} health check failed. Check tunnel, Access policy, and gateway.`,
    };
  }

  return {
    id: 'gateway',
    label: 'Beauty API gateway',
    status: 'verify',
    owner: 'Team member',
    detail: `Run Health to verify ${TEAM_BASE_URL} from this client.`,
  };
}
