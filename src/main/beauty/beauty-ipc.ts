import {
  BeautyApiClient,
  BeautyApiError,
  redactBeautyApiSecret,
  type BeautyAnalystRunRequest,
  type BeautyQuestionRequest,
} from './beauty-api-client';
import type { BeautyConfigInput, BeautyConfigStoreLike } from './beauty-config-store';
import type {
  BeautyDecisionPacketInput,
  BeautyPacketListFilters,
  BeautyPacketStoreLike,
} from './beauty-packet-store';

interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

interface BeautyApiClientLike {
  health(): Promise<unknown>;
  tools(): Promise<unknown>;
  intentBrief(payload: BeautyQuestionRequest): Promise<unknown>;
  startAnalystRun(payload: BeautyAnalystRunRequest): Promise<unknown>;
  answerResult(runId: string): Promise<unknown>;
  analystQueue(limit?: number): Promise<unknown>;
}

interface RegisterBeautyIpcOptions {
  configStore: BeautyConfigStoreLike;
  packetStore?: BeautyPacketStoreLike;
  createClient?: () => BeautyApiClientLike;
  logError?: (...args: unknown[]) => void;
}

export function registerBeautyIpcHandlers(
  ipcMain: IpcMainLike,
  options: RegisterBeautyIpcOptions
): void {
  const getClient = (): BeautyApiClientLike => {
    if (options.createClient) {
      return options.createClient();
    }
    const config = options.configStore.getSecretConfig();
    return new BeautyApiClient({
      baseUrl: config.baseUrl,
      tokenProvider: () => options.configStore.getSecretConfig().token,
    });
  };

  ipcMain.handle('beauty.getConfig', () => options.configStore.getPublicConfig());

  ipcMain.handle('beauty.saveConfig', (_event, input: unknown) => ({
    success: true,
    config: options.configStore.save(input as BeautyConfigInput),
  }));

  ipcMain.handle('beauty.health', () =>
    invokeBeautyHandler(() => getClient().health(), options.logError)
  );

  ipcMain.handle('beauty.tools', () =>
    invokeBeautyHandler(() => getClient().tools(), options.logError)
  );

  ipcMain.handle('beauty.intentBrief', (_event, payload: unknown) =>
    invokeBeautyHandler(
      () => getClient().intentBrief(payload as BeautyQuestionRequest),
      options.logError
    )
  );

  ipcMain.handle('beauty.analystRun', (_event, payload: unknown) =>
    invokeBeautyHandler(
      () => getClient().startAnalystRun(payload as BeautyAnalystRunRequest),
      options.logError
    )
  );

  ipcMain.handle('beauty.answerResult', (_event, runId: unknown) =>
    invokeBeautyHandler(() => getClient().answerResult(String(runId)), options.logError)
  );

  ipcMain.handle('beauty.analystQueue', (_event, limit: unknown) =>
    invokeBeautyHandler(
      () => getClient().analystQueue(typeof limit === 'number' ? limit : undefined),
      options.logError
    )
  );

  if (options.packetStore) {
    ipcMain.handle('beauty.savePacket', (_event, input: unknown) =>
      options.packetStore?.save(input as BeautyDecisionPacketInput)
    );

    ipcMain.handle('beauty.listPackets', (_event, filters: unknown) =>
      options.packetStore?.list(filters as BeautyPacketListFilters)
    );

    ipcMain.handle('beauty.getPacket', (_event, id: unknown) =>
      options.packetStore?.get(String(id))
    );

    ipcMain.handle('beauty.deletePacket', (_event, id: unknown) => ({
      success: Boolean(options.packetStore?.delete(String(id))),
    }));
  }
}

async function invokeBeautyHandler(
  operation: () => Promise<unknown>,
  logError?: (...args: unknown[]) => void
): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    const safeMessage = toSafeBeautyErrorMessage(error);
    logError?.('[BeautyAPI]', safeMessage);
    throw new Error(safeMessage);
  }
}

function toSafeBeautyErrorMessage(error: unknown): string {
  if (error instanceof BeautyApiError) {
    return redactBeautyApiSecret(error.message);
  }
  if (error instanceof Error) {
    return redactBeautyApiSecret(error.message);
  }
  return redactBeautyApiSecret(String(error));
}
