/**
 * Tests for workspace normalization utility
 * 
 * Ensures consistent handling of workspace names and paths
 * across different execution contexts and external agents
 */

import { normalizeWorkspaceName } from '../core/workspace-utils.js';

describe('Workspace Normalization', () => {
  describe('Basic normalization', () => {
    test('should normalize simple workspace names', () => {
      expect(normalizeWorkspaceName('MyProject')).toBe('myproject');
      expect(normalizeWorkspaceName('COA Goldfish MCP')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('user-repository')).toBe('user-repository');
    });

    test('should handle mixed case and special characters', () => {
      expect(normalizeWorkspaceName('API_Gateway_Service')).toBe('api-gateway-service');
      expect(normalizeWorkspaceName('Test@Project#123')).toBe('test-project-123');
      expect(normalizeWorkspaceName('my.awesome.project')).toBe('my-awesome-project');
    });

    test('should handle edge cases', () => {
      expect(normalizeWorkspaceName('   spaced project   ')).toBe('spaced-project');
      expect(normalizeWorkspaceName('multiple---dashes')).toBe('multiple-dashes');
      expect(normalizeWorkspaceName('---leading-trailing---')).toBe('leading-trailing');
      expect(normalizeWorkspaceName('')).toBe('');
      expect(normalizeWorkspaceName('123numeric456')).toBe('123numeric456');
    });
  });

  describe('Path handling', () => {
    test('should extract project name from Windows paths', () => {
      expect(normalizeWorkspaceName('C:\\source\\COA Goldfish MCP')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('C:\\Users\\User\\Documents\\My Project')).toBe('my-project');
      expect(normalizeWorkspaceName('D:\\dev\\api-gateway\\service')).toBe('service');
      expect(normalizeWorkspaceName('\\\\server\\share\\project')).toBe('project');
    });

    test('should extract project name from Unix paths', () => {
      expect(normalizeWorkspaceName('/home/user/COA Goldfish MCP')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('/var/www/my-awesome-project')).toBe('my-awesome-project');
      expect(normalizeWorkspaceName('/opt/local/bin/service')).toBe('service');
      expect(normalizeWorkspaceName('./relative/path/project')).toBe('project');
    });

    test('should handle mixed path separators', () => {
      expect(normalizeWorkspaceName('C:/source/COA Goldfish MCP')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('C:\\source/mixed\\separators/project')).toBe('project');
    });

    test('should handle paths with trailing separators', () => {
      expect(normalizeWorkspaceName('C:\\source\\COA Goldfish MCP\\')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('/home/user/project/')).toBe('project');
      expect(normalizeWorkspaceName('C:/source/project///')).toBe('project');
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle GPT agent absolute path inputs', () => {
      // What GPT agents typically send
      expect(normalizeWorkspaceName('c:\\source\\COA Goldfish MCP')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('C:\\Users\\CHS300372\\Projects\\API Gateway')).toBe('api-gateway');
    });

    test('should handle VS Code extension contexts', () => {
      // Common VS Code extension working directories
      expect(normalizeWorkspaceName('C:\\Users\\CHS300372')).toBe('chs300372');
      expect(normalizeWorkspaceName('/home/developer')).toBe('developer');
      expect(normalizeWorkspaceName('C:\\Program Files\\VSCode\\workspace')).toBe('workspace');
    });

    test('should match existing workspace names', () => {
      // These should be idempotent - already normalized names stay the same
      expect(normalizeWorkspaceName('coa-goldfish-mcp')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('api-gateway-service')).toBe('api-gateway-service');
      expect(normalizeWorkspaceName('user123')).toBe('user123');
    });

    test('should handle Docker and container paths', () => {
      expect(normalizeWorkspaceName('/app/src/my-service')).toBe('my-service');
      expect(normalizeWorkspaceName('/workspace/project-name')).toBe('project-name');
      expect(normalizeWorkspaceName('/usr/src/app')).toBe('app');
    });
  });

  describe('External agent compatibility', () => {
    test('should normalize various agent inputs to consistent format', () => {
      const inputs = [
        'COA Goldfish MCP',
        'C:\\source\\COA Goldfish MCP',
        'c:/source/COA Goldfish MCP',
        '/path/to/COA Goldfish MCP',
        './COA Goldfish MCP',
        'COA_Goldfish_MCP'
      ];
      
      const expected = 'coa-goldfish-mcp';
      inputs.forEach(input => {
        expect(normalizeWorkspaceName(input)).toBe(expected);
      });
    });

    test('should handle common project naming patterns', () => {
      const testCases = [
        { input: 'frontend-app', expected: 'frontend-app' },
        { input: 'backend_service', expected: 'backend-service' },
        { input: 'MyReactApp', expected: 'myreactapp' },
        { input: 'user-management-system', expected: 'user-management-system' },
        { input: 'API.Gateway.v2', expected: 'api-gateway-v2' },
        { input: 'mobile-app@2024', expected: 'mobile-app-2024' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(normalizeWorkspaceName(input)).toBe(expected);
      });
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle very long paths', () => {
      const longPath = 'C:\\very\\long\\path\\with\\many\\segments\\and\\a\\very\\long\\project\\name\\that\\goes\\on\\and\\on';
      expect(normalizeWorkspaceName(longPath)).toBe('on'); // Only gets the last segment
    });

    test('should handle empty and null-like inputs', () => {
      expect(normalizeWorkspaceName('')).toBe('');
      expect(normalizeWorkspaceName('   ')).toBe('');
      expect(normalizeWorkspaceName('---')).toBe('');
      expect(normalizeWorkspaceName('///')).toBe('');
      expect(normalizeWorkspaceName('\\\\\\')).toBe('');
    });

    test('should handle unicode and international characters', () => {
      expect(normalizeWorkspaceName('项目名称')).toBe('');  // Non-ASCII removed
      expect(normalizeWorkspaceName('proyecto-español')).toBe('proyecto-espa-ol');
      expect(normalizeWorkspaceName('MyProject-日本語')).toBe('myproject'); // Trailing dash removed
    });
  });
});