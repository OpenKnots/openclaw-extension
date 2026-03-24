import { describe, expect, it } from 'vitest';
import { ChatService } from '../chat/ChatService';

describe('ChatService.getPermissionsForChatType', () => {
    it('forces chat mode to stay read-only', () => {
        expect(ChatService.getPermissionsForChatType('chat', 'approve-all')).toBe('approve-reads');
        expect(ChatService.getPermissionsForChatType('chat', 'deny-all')).toBe('approve-reads');
    });

    it('preserves configured permissions for non-chat modes', () => {
        expect(ChatService.getPermissionsForChatType('code', 'approve-all')).toBe('approve-all');
        expect(ChatService.getPermissionsForChatType('review', 'deny-all')).toBe('deny-all');
    });
});
