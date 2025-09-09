/**
 * Simple loader for optional VS Code Bridge integration
 * 
 * Connects Goldfish to VS Code for data visualization
 */

import { GoldfishDisplayHandler } from './display-handler.js';

/**
 * Initialize VS Code bridge connection if available
 */
export async function initializeVSCodeDisplay(): Promise<GoldfishDisplayHandler> {
  try {
    // Try to import the VS Code bridge package
    const bridgeModule = await import('@coa/mcp-vscode-bridge');
    
    if (!bridgeModule || !bridgeModule.VSCodeBridge) {
      console.error('ℹ️ VS Code bridge not available (optional feature)');
      return new GoldfishDisplayHandler(); // Return handler without bridge
    }
    
    // Create VS Code bridge connection
    const VSCodeBridge = bridgeModule.VSCodeBridge;
    const vscBridge = new VSCodeBridge({
      url: 'ws://localhost:7823/mcp',
      autoConnect: true,
      throwOnConnectionFailure: false, // Graceful degradation
      throwOnDisplayFailure: false
    });
    
    // Connect to the bridge
    await vscBridge.connect();
    
    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (vscBridge.isConnected) {
      console.error('✅ Connected to VS Code bridge for visualizations');
    }
    
    // Create display handler with bridge
    return new GoldfishDisplayHandler(vscBridge as any);
    
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('ℹ️ VS Code bridge package not installed (optional)');
    } else {
      console.warn('⚠️ VS Code bridge initialization failed:', error.message);
    }
    
    // Return handler without bridge - Goldfish still works normally
    return new GoldfishDisplayHandler();
  }
}
