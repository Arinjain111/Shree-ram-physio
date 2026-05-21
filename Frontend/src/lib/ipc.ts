const { electronAPI } = window;

export const ipcRenderer = {
  invoke: (channel: string, ...args: unknown[]): Promise<any> => electronAPI.invoke(channel, ...args) as Promise<any>,
  on: (channel: string, listener: (...args: unknown[]) => void): (() => void) => {
    const cleanup = electronAPI.on(channel, listener);
    return cleanup;
  },
  removeListener: (channel: string, listener: (...args: unknown[]) => void): void => {
    electronAPI.removeListener(channel, listener);
  },
};
