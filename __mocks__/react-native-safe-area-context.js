const INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const FRAME = { width: 320, height: 640, x: 0, y: 0 };

module.exports = {
  useSafeAreaInsets: () => INSETS,
  useSafeAreaFrame: () => FRAME,
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  SafeAreaConsumer: ({ children }) => children(INSETS),
  initialWindowMetrics: { frame: FRAME, insets: INSETS },
};
