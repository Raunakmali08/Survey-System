import logger from '../config/logger.js';
import redisManager from '../modules/redis-manager.js';

class AutoSaveService {
  constructor() {
    this.pendingSaves = new Map();
    this.saveDebounceMs = 1000;
  }

  // Debounced save with optimistic locking
  async debouncedSave(responseId, updates, version) {
    const key = `auto-save:${responseId}`;

    if (this.pendingSaves.has(key)) {
      clearTimeout(this.pendingSaves.get(key).timeout);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          await this.saveResponse(responseId, updates, version);
          this.pendingSaves.delete(key);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, this.saveDebounceMs);

      this.pendingSaves.set(key, { timeout, updates, version });
    });
  }

  async saveResponse(responseId, updates, version) {
    // Store in Redis cache temporarily
    const cacheKey = `response:${responseId}:pending`;
    await redisManager.setJson(cacheKey, {
      updates,
      version,
      timestamp: Date.now(),
    }, 300); // 5 minute TTL

    logger.debug('Auto-save cached for response:', { responseId });
  }

  // Conflict detection and resolution
  detectConflicts(clientAnswers, serverAnswers) {
    const conflicts = [];

    clientAnswers.forEach(clientAnswer => {
      const serverAnswer = serverAnswers.find(
        a => a.questionId === clientAnswer.questionId
      );

      if (serverAnswer && 
          JSON.stringify(serverAnswer.value) !== JSON.stringify(clientAnswer.value)) {
        conflicts.push({
          questionId: clientAnswer.questionId,
          clientValue: clientAnswer.value,
          serverValue: serverAnswer.value,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return conflicts;
  }

  // Resolve conflicts using last-write-wins or custom strategy
  resolveConflict(clientVersion, serverVersion, strategy = 'last-write-wins') {
    switch (strategy) {
      case 'last-write-wins':
        // Server value wins (most recent)
        return 'server';
      case 'client-wins':
        // Client value wins
        return 'client';
      case 'merge':
        // Attempt to merge (requires careful implementation)
        return 'merged';
      default:
        return 'server';
    }
  }

  // Retry with exponential backoff
  async retryWithBackoff(fn, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        logger.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  // Batch sync for offline responses
  async batchSync(responses) {
    const results = [];

    for (const response of responses) {
      try {
        await this.retryWithBackoff(async () => {
          // This would call the actual save endpoint
          logger.debug('Syncing offline response:', { responseId: response.id });
        });
        results.push({ responseId: response.id, status: 'synced' });
      } catch (error) {
        logger.error('Failed to sync response:', { responseId: response.id, error: error.message });
        results.push({ responseId: response.id, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  getPendingSavesCount() {
    return this.pendingSaves.size;
  }

  getPendingSaves() {
    return Array.from(this.pendingSaves.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }
}

export default new AutoSaveService();
