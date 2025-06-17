global.browser = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() }
  },
  contextMenus: {
    removeAll: jest.fn(),
    create: jest.fn(),
    onClicked: { addListener: jest.fn() }
  },
  commands: {
    onCommand: { addListener: jest.fn() }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
}; 